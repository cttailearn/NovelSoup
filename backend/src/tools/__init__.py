from langchain_core.tools import tool
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime
import json

from ..models import Chapter, Character
from ..utils.database import async_session


@tool(args_schema=None)
async def read_chapter(chapter_id: str) -> str:
    """读取指定章节的内容

    Args:
        chapter_id: 章节ID
    """
    async with async_session() as session:
        result = await session.execute(select(Chapter).where(Chapter.id == chapter_id))
        chapter = result.scalar_one_or_none()
        if not chapter:
            return f"Chapter {chapter_id} not found"
        return f"=== {chapter.title} ===\n\n{chapter.content}"


@tool(args_schema=None)
async def list_chapters(project_id: str) -> str:
    """列出项目中的所有章节

    Args:
        project_id: 项目ID
    """
    async with async_session() as session:
        result = await session.execute(
            select(Chapter)
            .where(Chapter.project_id == project_id)
            .order_by(Chapter.sort_order)
        )
        chapters = result.scalars().all()
        if not chapters:
            return "No chapters found"
        lines = []
        for ch in chapters:
            lines.append(f"- [{ch.sort_order}] {ch.title} (id: {ch.id})")
        return "\n".join(lines)


@tool(args_schema=None)
async def save_chapter(chapter_id: str, content: str) -> str:
    """保存章节内容

    Args:
        chapter_id: 章节ID
        content: 新内容
    """
    async with async_session() as session:
        result = await session.execute(select(Chapter).where(Chapter.id == chapter_id))
        chapter = result.scalar_one_or_none()
        if not chapter:
            return f"Chapter {chapter_id} not found"
        chapter.content = content
        chapter.update_time = int(datetime.now().timestamp() * 1000)
        await session.commit()
        return f"Chapter {chapter.title} updated ({len(content)} chars)"


@tool(args_schema=None)
async def list_characters(project_id: str) -> str:
    """列出项目中的人物

    Args:
        project_id: 项目ID
    """
    async with async_session() as session:
        result = await session.execute(
            select(Character).where(Character.project_id == project_id)
        )
        characters = result.scalars().all()
        if not characters:
            return "No characters found"
        lines = []
        for char in characters:
            lines.append(f"- {char.name}")
            if char.description:
                lines.append(f"  {char.description}")
        return "\n".join(lines)


@tool(args_schema=None)
async def get_character(character_id: str) -> str:
    """获取人物详细信息

    Args:
        character_id: 人物ID
    """
    async with async_session() as session:
        result = await session.execute(
            select(Character).where(Character.id == character_id)
        )
        char = result.scalar_one_or_none()
        if not char:
            return f"Character {character_id} not found"
        info = [f"Name: {char.name}"]
        if char.description:
            info.append(f"Description: {char.description}")
        if char.aliases and char.aliases not in ("[]", None):
            try:
                aliases = json.loads(char.aliases)
                if aliases:
                    info.append(f"Aliases: {', '.join(aliases)}")
            except json.JSONDecodeError:
                pass
        if char.traits and char.traits not in ("{}", None):
            try:
                traits = json.loads(char.traits)
                if traits:
                    info.append("Traits:")
                    for k, v in traits.items():
                        info.append(f"  - {k}: {v}")
            except json.JSONDecodeError:
                pass
        if char.relations and char.relations not in ("{}", None):
            try:
                relations = json.loads(char.relations)
                if relations:
                    info.append("Relations:")
                    for k, v in relations.items():
                        info.append(f"  - {k}: {v}")
            except json.JSONDecodeError:
                pass
        return "\n".join(info)


@tool(args_schema=None)
async def recall_memory(query: str, project_id: str) -> str:
    """从项目记忆中检索相关内容（使用向量相似度搜索）

    Args:
        query: 搜索查询
        project_id: 项目ID
    """
    from ..utils import search_memories

    isolation_key = f"project:{project_id}"
    memories = search_memories(query=query, isolation_key=isolation_key, k=5)

    if not memories:
        return "No relevant memories found"

    lines = []
    for mem in memories:
        content_preview = mem["content"][:300] if len(mem["content"]) > 300 else mem["content"]
        lines.append(f"[{mem['type']}] {content_preview}")
    return "\n\n".join(lines)


@tool(args_schema=None)
async def save_memory(
    content: str,
    memory_type: str,
    project_id: str,
    role: str = None,
    name: str = None,
    chapter_id: str = None,
) -> str:
    """保存重要内容到长期记忆（同时保存到向量数据库）

    Args:
        content: 记忆内容
        memory_type: 记忆类型 (message/summary/character/plot_hook)
        project_id: 项目ID
        role: 角色
        name: 名称
        chapter_id: 章节ID
    """
    from ..utils import add_memory
    import uuid

    isolation_key = f"project:{project_id}"
    memory_id = str(uuid.uuid4())
    now = int(datetime.now().timestamp() * 1000)

    async with async_session() as session:
        from ..models import Memory

        memory = Memory(
            id=memory_id,
            isolation_key=isolation_key,
            type=memory_type,
            role=role,
            name=name,
            content=content,
            chapter_id=chapter_id,
            create_time=now,
        )
        session.add(memory)
        await session.commit()

    try:
        add_memory(
            id=memory_id,
            content=content[:1000],
            metadata={
                "isolation_key": isolation_key,
                "type": memory_type,
                "role": role,
                "name": name,
            },
        )
    except Exception:
        pass

    return f"Memory saved: {content[:100]}..."


@tool(args_schema=None)
async def clear_memory(project_id: str) -> str:
    """清空项目所有记忆

    Args:
        project_id: 项目ID
    """
    isolation_key = f"project:{project_id}"
    async with async_session() as session:
        from ..models import Memory

        result = await session.execute(
            select(Memory).where(Memory.isolation_key == isolation_key)
        )
        memories = result.scalars().all()
        for mem in memories:
            await session.delete(mem)
        await session.commit()
    return f"Cleared {len(memories)} memories"