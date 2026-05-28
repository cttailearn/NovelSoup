from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime
import uuid
import json
import re
from typing import Optional

from ..models import Character, Chapter, CharacterExtractConfig, CharacterExtractRecord, Project
from ..utils.database import get_db, async_session
from ..utils.chat_model import create_execution_model
from langchain_core.messages import HumanMessage, SystemMessage

router = APIRouter(prefix="/character-extract", tags=["character-extract"])


BUILTIN_FIELDS = [
    {"field": "name", "label": "姓名", "type": "text", "required": True, "description": "人物的主要名称"},
    {"field": "aliases", "label": "别名", "type": "text", "required": False, "description": "人物的别称、绰号"},
    {"field": "description", "label": "描述", "type": "textarea", "required": False, "description": "人物身份、外貌、背景"},
    {"field": "traits", "label": "性格", "type": "object", "required": False, "description": "主要性格特征"},
    {"field": "relations", "label": "关系", "type": "object", "required": False, "description": "与其他人物的关系"},
    {"field": "appearance", "label": "外貌", "type": "text", "required": False, "description": "人物外貌特征"},
    {"field": "background", "label": "背景", "type": "textarea", "required": False, "description": "人物背景故事"},
    {"field": "abilities", "label": "能力", "type": "text", "required": False, "description": "人物特殊能力"},
]


EXTRACT_PROMPT_TEMPLATE = """你是一个专业的小说分析助手。请从小说文本中提取人物信息。

## 提取字段（请根据这些字段提取信息，标记[必填]的字段必须有值）
{fields_description}

## 提取要求
1. 识别小说中的主要人物
2. 仔细阅读文本，根据言行举止推断人物性格
3. 注意人物之间的互动关系
4. 对于标记为[必填]的字段，如果文本中未明确提及，请基于人物言行合理推断
5. 返回 JSON 格式结果

## 输出格式
严格按以下JSON格式返回，不要添加任何解释：
```json
[
  {{
    "name": "人物姓名[必填]",
    "aliases": "别名1、别名2",
    "description": "人物描述",
    "traits": {{"性格特征1": "在文中的表现", "性格特征2": "在文中的表现"}},
    "relations": {{"关系人物": "关系描述"}},
    "appearance": "外貌描述",
    "background": "背景故事",
    "abilities": "特殊能力"
  }},
  ...
]
```

## 补全规则
- 如果某个字段在文本中没有明确信息，请基于人物性格和情节合理推断
- 推断时要保证与文中已有信息保持一致
- 对于name字段，绝对不能为空"""


MERGE_PROMPT_TEMPLATE = """你是一个专业的小说人物设定助手。请将新提取的人物与已有的人物信息合并。

## 已有的人物信息
{existing_characters}

## 新提取的人物信息
{new_characters}

## 合并规则
1. 如果新人物与已有人物同名或别名相同，判断为同一人，进行合并
2. 合并时保留已有信息，补充新发现的信息
3. 如果已有人物缺失某些字段，用新提取的信息补全
4. 如果新信息与已有人物信息矛盾，以已有信息为准
5. 对于已有人物的缺失字段，尝试从新信息中补全或合理推断

## 输出格式
返回合并后的完整人物列表：
```json
[
  {{
    "action": "keep|merge|new",
    "name": "人物姓名",
    "aliases": "别名",
    "description": "人物描述",
    "traits": {{"性格": "表现"}},
    "relations": {{"他人": "关系"}},
    "appearance": "外貌",
    "background": "背景",
    "abilities": "能力",
    "merge_notes": "合并说明"
  }},
  ...
]
```"""


@router.post("/{project_id}")
async def extract_characters(
    request: Request,
    project_id: str,
    db: AsyncSession = Depends(get_db),
):
    body = await request.json()
    chapter_ids = body.get("chapter_ids")

    if not chapter_ids:
        raise HTTPException(status_code=400, detail="请选择要提取的章节")

    project_result = await db.execute(select(Project).where(Project.id == project_id))
    project = project_result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    chapter_id_list = [cid.strip() for cid in chapter_ids.split(",") if cid.strip()]
    chapters_result = await db.execute(
        select(Chapter)
        .where(Chapter.id.in_(chapter_id_list))
        .order_by(Chapter.sort_order)
    )
    chapters = list(chapters_result.scalars().all())

    if not chapters:
        raise HTTPException(status_code=400, detail="未找到指定的章节")

    config_result = await db.execute(
        select(CharacterExtractConfig)
        .where(CharacterExtractConfig.project_id == project_id)
        .where(CharacterExtractConfig.is_active == True)
    )
    config = config_result.scalar_one_or_none()

    fields = BUILTIN_FIELDS.copy()
    if config and config.fields:
        try:
            user_fields = json.loads(config.fields)
            field_map = {f["field"]: f for f in user_fields}
            for bf in fields:
                if bf["field"] in field_map:
                    bf.update(field_map[bf["field"]])
            for uf in user_fields:
                if uf["field"] not in [f["field"] for f in fields]:
                    fields.append(uf)
        except:
            pass

    selected_fields = [f for f in fields if f.get("enabled", True)]
    if not any(f.get("required") for f in selected_fields):
        selected_fields = [f for f in selected_fields if f.get("required", False)] or selected_fields[:1]

    fields_description = "\n".join([
        f"- {f['label']}({f['field']}): {f.get('description', '')}" +
        (" [必填]" if f.get("required") else "")
        for f in selected_fields
    ])

    content = "\n\n".join([f"=== {ch.title} ===\n{ch.content}" for ch in chapters])
    max_chars = 25000
    if len(content) > max_chars:
        content = content[:max_chars] + "\n\n...(内容过长已截断)..."

    try:
        llm = create_execution_model()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI模型初始化失败: {str(e)}")

    extract_prompt = EXTRACT_PROMPT_TEMPLATE.format(fields_description=fields_description)

    try:
        response = await llm.invoke([
            SystemMessage(content=extract_prompt),
            HumanMessage(content=f"请分析以下小说内容，提取人物信息：\n\n{content}"),
        ])
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI调用失败: {str(e)}")

    content_str = response.content.strip() if hasattr(response, 'content') else str(response)

    json_match = re.search(r"\[[\s\S]*\]", content_str)
    if json_match:
        try:
            new_characters = json.loads(json_match.group(0))
        except json.JSONDecodeError:
            new_characters = []
    else:
        new_characters = []

    existing_result = await db.execute(
        select(Character).where(Character.project_id == project_id)
    )
    existing_characters = list(existing_result.scalars().all())

    existing_data = []
    for c in existing_characters:
        try:
            traits = json.loads(c.traits) if c.traits else {}
        except:
            traits = {}
        try:
            relations = json.loads(c.relations) if c.relations else {}
        except:
            relations = {}

        char_dict = {
            "id": c.id,
            "name": c.name,
            "aliases": c.aliases or "",
            "description": c.description or "",
            "traits": traits,
            "relations": relations,
            "appearance": "",
            "background": "",
            "abilities": "",
        }
        existing_data.append(char_dict)

    if existing_characters and new_characters:
        merge_prompt = MERGE_PROMPT_TEMPLATE.format(
            existing_characters=json.dumps(existing_data, ensure_ascii=False, indent=2),
            new_characters=json.dumps(new_characters, ensure_ascii=False, indent=2),
        )
        try:
            merge_response = await llm.invoke([
                SystemMessage(content=merge_prompt),
                HumanMessage(content="请合并人物信息"),
            ])
            merge_content = merge_response.content.strip() if hasattr(merge_response, 'content') else str(merge_response)
            merge_json_match = re.search(r"\[[\s\S]*\]", merge_content)
            if merge_json_match:
                merged_results = json.loads(merge_json_match.group(0))
            else:
                merged_results = [{"action": "new", **c} for c in new_characters]
        except Exception as e:
            merged_results = [{"action": "new", **c} for c in new_characters]
    elif new_characters:
        merged_results = [{"action": "new", **c} for c in new_characters]
    else:
        merged_results = []

    now = int(datetime.now().timestamp() * 1000)
    saved_characters = []
    total_new = len(merged_results)

    async with async_session() as session:
        for idx, result in enumerate(merged_results):
            action = result.get("action", "new")
            name = result.get("name", "").strip()

            if not name:
                continue

            if action == "keep":
                continue

            character_id = str(uuid.uuid4())

            if action == "merge" and result.get("id"):
                character_id = result["id"]
                merge_result = await session.execute(
                    select(Character).where(Character.id == character_id)
                )
                existing_char = merge_result.scalar_one_or_none()
                if existing_char:
                    if result.get("aliases") and not existing_char.aliases:
                        existing_char.aliases = result.get("aliases")
                    if result.get("description") and not existing_char.description:
                        existing_char.description = result.get("description")
                    if result.get("traits"):
                        try:
                            existing_traits = json.loads(existing_char.traits or "{}")
                            existing_traits.update(result.get("traits", {}))
                            existing_char.traits = json.dumps(existing_traits)
                        except:
                            pass
                    if result.get("relations"):
                        try:
                            existing_relations = json.loads(existing_char.relations or "{}")
                            existing_relations.update(result.get("relations", {}))
                            existing_char.relations = json.dumps(existing_relations)
                        except:
                            pass
                    existing_char.update_time = now
                    saved_characters.append({
                        "id": character_id,
                        "name": existing_char.name,
                    })
                    continue

            character = Character(
                id=character_id,
                project_id=project_id,
                name=name,
                aliases=result.get("aliases", ""),
                description=result.get("description", ""),
                traits=json.dumps(result.get("traits", {})),
                relations=json.dumps(result.get("relations", {})),
                status="active",
                create_time=now,
                update_time=now,
            )
            session.add(character)
            saved_characters.append({
                "id": character_id,
                "name": name,
            })

        await session.commit()

    record = CharacterExtractRecord(
        id=str(uuid.uuid4()),
        project_id=project_id,
        chapter_ids=",".join(chapter_id_list),
        extracted_count=total_new,
        merged_count=len(saved_characters),
        status="completed",
        result_data=json.dumps(saved_characters, ensure_ascii=False),
        create_time=now,
        update_time=now,
    )
    db.add(record)
    await db.commit()

    return {
        "success": True,
        "extracted_count": total_new,
        "merged_count": len(saved_characters),
        "characters": saved_characters,
    }


@router.get("/config/{project_id}")
async def get_extract_config(project_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(CharacterExtractConfig)
        .where(CharacterExtractConfig.project_id == project_id)
        .where(CharacterExtractConfig.is_active == True)
    )
    config = result.scalar_one_or_none()

    if config and config.fields:
        try:
            return {"fields": json.loads(config.fields)}
        except:
            pass

    return {"fields": BUILTIN_FIELDS}


@router.put("/config/{project_id}")
async def update_extract_config(
    project_id: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    body = await request.json()
    fields = body.get("fields", BUILTIN_FIELDS)

    existing = await db.execute(
        select(CharacterExtractConfig)
        .where(CharacterExtractConfig.project_id == project_id)
        .where(CharacterExtractConfig.is_active == True)
    )
    config = existing.scalar_one_or_none()

    now = int(datetime.now().timestamp() * 1000)

    if config:
        config.fields = json.dumps(fields)
        config.update_time = now
    else:
        config = CharacterExtractConfig(
            id=str(uuid.uuid4()),
            project_id=project_id,
            fields=json.dumps(fields),
            max_characters=50,
            is_active=True,
            create_time=now,
            update_time=now,
        )
        db.add(config)

    await db.commit()
    return {"success": True}


@router.get("/records/{project_id}")
async def get_extract_records(project_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(CharacterExtractRecord)
        .where(CharacterExtractRecord.project_id == project_id)
        .order_by(CharacterExtractRecord.create_time.desc())
    )
    records = result.scalars().all()
    return [
        {
            "id": r.id,
            "chapter_ids": r.chapter_ids,
            "extracted_count": r.extracted_count,
            "merged_count": r.merged_count,
            "status": r.status,
            "create_time": r.create_time,
        }
        for r in records
    ]


@router.get("/available-fields")
async def get_available_fields():
    return {"fields": BUILTIN_FIELDS}