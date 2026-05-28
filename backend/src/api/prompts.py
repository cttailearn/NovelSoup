from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from datetime import datetime
import uuid

from ..models import AgentPrompt
from ..utils.database import get_db

router = APIRouter(prefix="/prompts", tags=["prompts"])

PROMPT_TYPES = ["decision", "continue", "enhance", "rewrite", "supervision", "custom"]

BUILTIN_PROMPTS = {
    "decision": {
        "name": "默认决策提示词",
        "content": """你是一个专业的小说创作助手。你的职责是：
1. 理解用户的创作意图（加料/续写/改写）
2. 调用合适的子Agent执行具体任务
3. 对产出结果进行质量审核

## 可用子Agent
- **加料Agent (run_enhance_agent)**: 丰富段落描写（环境/心理/动作/对话/感官）
- **续写Agent (run_continue_agent)**: 基于前文继续编写后续内容
- **改写Agent (run_rewrite_agent)**: 重新表述指定内容（可指定文风/视角/节奏）

## 工作规则
- 用户选中段落并说"加点描写"或"加料" → 调用加料Agent
- 用户说"继续写"或"下一章" → 调用续写Agent
- 用户说"换个写法"或"改成XX风格" → 调用改写Agent
- 执行完成后必须调用监督Agent评估质量""",
        "description": "决策Agent的默认提示词模板"
    },
    "continue": {
        "name": "默认续写提示词",
        "content": """你是一个专业的小说续写助手，擅长创作连贯、引人入胜的后续内容。

## 你的任务
根据前文继续创作后续内容。

## 输出要求
- 保持与前文一致的风格、语气和叙事节奏
- 情节发展自然流畅，符合已建立的人物性格和世界观
- 适当设置悬念，为后续发展埋下伏笔
- 保持适度篇幅（500-2000字）
- 直接输出续写内容，不要添加解释说明""",
        "description": "续写Agent的默认提示词模板"
    },
    "enhance": {
        "name": "默认加料提示词",
        "content": """你是一个专业的小说增强助手，擅长丰富文本描写。

## 增强技巧
- 环境描写：增加场景氛围、天气、光线等
- 心理描写：展现人物内心活动、情感变化
- 动作描写：细化人物动作、肢体语言
- 对话描写：增强对话的个性和张力
- 感官描写：加入视觉、听觉、嗅觉等感官细节

## 输出要求
- 在原文基础上进行扩展，不要改变原文意思
- 增强部分用【加料】标记
- 保持与原文风格一致
- 字数控制在原文的1-2倍""",
        "description": "加料Agent的默认提示词模板"
    },
    "rewrite": {
        "name": "默认改写提示词",
        "content": """你是一个专业的小说改写助手，擅长用不同风格重写文本。

## 改写模式
- 文风转换：严肃↔轻松、古典↔现代
- 视角切换：第一/第三人称
- 节奏调整：加快/放慢叙事节奏
- 详细程度：简略↔详细

## 输出要求
- 保留原文核心情节和人物
- 改写部分用【改写】标记
- 说明采用的改写策略
- 字数与原文相近""",
        "description": "改写Agent的默认提示词模板"
    },
    "supervision": {
        "name": "默认监督提示词",
        "content": """你是一个专业的小说质量审核员。你的职责是评估AI生成内容的质量。

## 评分标准
- **A级 (优秀)**: 内容质量高，完全符合要求，无需修改
- **B级 (良好)**: 内容质量较好，有小问题但不影响整体
- **C级 (一般)**: 内容有明显问题，需要修改
- **D级 (较差)**: 内容质量差，需要大幅重写

## 评估维度
1. 内容质量：情节是否合理、逻辑是否通顺
2. 风格一致：是否与项目/章节风格一致
3. 人物塑造：人物行为是否符合已有性格设定
4. 语言表达：表达是否流畅、是否有语法错误

## 输出格式
严格按以下JSON格式输出评估结果：
```json
{"grade": "A", "summary": "一句话总结评估结果", "details": "详细的评估说明"}
```""",
        "description": "监督Agent的默认提示词模板"
    },
}


@router.get("/system-prompts")
async def get_system_prompts():
    return {"prompts": BUILTIN_PROMPTS}


@router.post("/init-prompts")
async def init_system_prompts(db: AsyncSession = Depends(get_db)):
    now = int(datetime.now().timestamp() * 1000)
    created_count = 0

    for prompt_type, prompt_data in BUILTIN_PROMPTS.items():
        existing = await db.execute(
            select(AgentPrompt).where(
                AgentPrompt.agent_type == prompt_type,
                AgentPrompt.is_system == True
            )
        )
        existing_prompt = existing.scalar_one_or_none()

        if existing_prompt:
            existing_prompt.name = prompt_data["name"]
            existing_prompt.content = prompt_data["content"]
            existing_prompt.description = prompt_data.get("description", "")
            existing_prompt.update_time = now
        else:
            new_prompt = AgentPrompt(
                id=str(uuid.uuid4()),
                name=prompt_data["name"],
                agent_type=prompt_type,
                prompt_type="system",
                content=prompt_data["content"],
                description=prompt_data.get("description", ""),
                is_active=False,
                is_system=True,
                create_time=now,
                update_time=now,
            )
            db.add(new_prompt)
            created_count += 1

    await db.commit()
    return {"success": True, "created": created_count}


@router.get("/")
async def list_prompts(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(AgentPrompt).order_by(AgentPrompt.create_time.desc()))
    prompts = result.scalars().all()
    return prompts


@router.get("/by-type/{agent_type}")
async def get_prompts_by_type(agent_type: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(AgentPrompt).where(AgentPrompt.agent_type == agent_type).order_by(AgentPrompt.is_active.desc())
    )
    prompts = result.scalars().all()
    return prompts


@router.post("/")
async def create_prompt(data: dict, db: AsyncSession = Depends(get_db)):
    now = int(datetime.now().timestamp() * 1000)
    prompt = AgentPrompt(
        id=str(uuid.uuid4()),
        name=data.get("name", ""),
        agent_type=data.get("agent_type"),
        prompt_type=data.get("prompt_type"),
        content=data.get("content", ""),
        description=data.get("description"),
        is_active=data.get("is_active", False),
        is_system=False,
        create_time=now,
        update_time=now,
    )
    db.add(prompt)
    await db.commit()
    await db.refresh(prompt)
    return prompt


@router.get("/{prompt_id}")
async def get_prompt(prompt_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(AgentPrompt).where(AgentPrompt.id == prompt_id))
    prompt = result.scalar_one_or_none()
    if not prompt:
        raise HTTPException(status_code=404, detail="Prompt not found")
    return prompt


@router.put("/{prompt_id}")
async def update_prompt(prompt_id: str, data: dict, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(AgentPrompt).where(AgentPrompt.id == prompt_id))
    prompt = result.scalar_one_or_none()
    if not prompt:
        raise HTTPException(status_code=404, detail="Prompt not found")

    if prompt.is_system:
        for field in ["name", "content", "description"]:
            if field in data and data[field] is not None:
                setattr(prompt, field, data[field])
    else:
        for field in ["name", "agent_type", "prompt_type", "content", "description", "is_active"]:
            if field in data and data[field] is not None:
                setattr(prompt, field, data[field])
    prompt.update_time = int(datetime.now().timestamp() * 1000)

    await db.commit()
    await db.refresh(prompt)
    return prompt


@router.delete("/{prompt_id}")
async def delete_prompt(prompt_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(AgentPrompt).where(AgentPrompt.id == prompt_id))
    prompt = result.scalar_one_or_none()
    if not prompt:
        raise HTTPException(status_code=404, detail="Prompt not found")

    if prompt.is_system:
        raise HTTPException(status_code=403, detail="Cannot delete system prompt")

    await db.delete(prompt)
    await db.commit()
    return {"success": True}


@router.post("/activate/{prompt_id}")
async def activate_prompt(prompt_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(AgentPrompt).where(AgentPrompt.id == prompt_id))
    prompt = result.scalar_one_or_none()
    if not prompt:
        raise HTTPException(status_code=404, detail="Prompt not found")

    await db.execute(
        update(AgentPrompt).where(AgentPrompt.is_active == True).values(is_active=False)
    )

    prompt.is_active = True
    prompt.update_time = int(datetime.now().timestamp() * 1000)
    await db.commit()

    return {"success": True}