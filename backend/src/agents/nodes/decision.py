from langchain_core.messages import HumanMessage, SystemMessage
from sqlalchemy import select

from ..state import AgentState
from ...models import Chapter, Character
from ...utils.database import async_session
from ...utils import search_memories, skills_loader


SYSTEM_PROMPT = """你是一个专业的小说创作助手。你的职责是：
1. 理解用户的创作意图（加料/续写/改写）
2. 调用合适的子Agent执行具体任务

## 任务类型判断规则
- 用户选中段落并说"加点描写"或"加料"或"增强" → action="enhance"
- 用户说"继续写"或"下一章"或"续写" → action="continue"
- 用户说"换个写法"或"改成XX风格"或"改写" → action="rewrite"
- 如果不确定，默认 action="continue"

## 工作规则
- 一个任务只调用一个执行Agent
- 如果用户需要特定的写作风格，可以激活对应技能
- 先理解再行动

请分析用户输入，输出你要执行的action。"""


async def build_context(state: AgentState) -> str:
    project_id = state.get("project_id")
    chapter_id = state.get("chapter_id")
    context_parts = []

    if project_id:
        isolation_key = f"project:{project_id}"
        memories = search_memories(
            query=state.get("messages", [])[-1].content if state.get("messages") else "",
            isolation_key=isolation_key,
            k=5,
        )
        if memories:
            context_parts.append("=== 相关记忆 ===")
            for mem in memories[:3]:
                content_preview = mem["content"][:200] if len(mem["content"]) > 200 else mem["content"]
                context_parts.append(f"- [{mem['type']}] {content_preview}")

        async with async_session() as session:
            result = await session.execute(
                select(Character).where(Character.project_id == project_id)
            )
            characters = result.scalars().all()
            if characters:
                context_parts.append("\n=== 人物信息 ===")
                for char in characters:
                    context_parts.append(f"- {char.name}: {char.description or '暂无描述'}")

            if chapter_id:
                result = await session.execute(
                    select(Chapter).where(Chapter.id == chapter_id)
                )
                chapter = result.scalar_one_or_none()
                if chapter:
                    context_parts.append(f"\n=== 当前章节: {chapter.title} ===")
                    context_parts.append(chapter.content[:2000])

    return "\n".join(context_parts)


async def decision_node(state: AgentState) -> AgentState:
    user_input = state["messages"][-1].content
    selected_text = state.get("selected_text", "")
    skill_names = state.get("skill_names", [])

    context = await build_context(state)
    skill_prompts = skills_loader.get_agent_prompt(skill_names)

    system_msg = SYSTEM_PROMPT
    if skill_prompts:
        system_msg += f"\n\n=== 激活的技能 ===\n{skill_prompts}"

    user_msg = f"""用户输入: {user_input}
选中文字: {selected_text or '无'}
当前上下文:
{context}"""

    from ...utils.chat_model import create_decision_model
    llm = create_decision_model()

    response = await llm.invoke([
        SystemMessage(content=system_msg),
        HumanMessage(content=user_msg),
    ])

    content = response.content.strip().lower()

    if "enhance" in content or "加料" in content or "增强" in content:
        action = "enhance"
    elif "rewrite" in content or "改写" in content:
        action = "rewrite"
    elif "continue" in content or "续写" in content or "继续" in content:
        action = "continue"
    else:
        action = "continue"

    return {
        **state,
        "action": action,
        "active_agent": "decision",
    }