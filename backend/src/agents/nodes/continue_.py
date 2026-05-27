from langchain_core.messages import HumanMessage, SystemMessage
from sqlalchemy import select
from ..state import AgentState
from ...utils.database import async_session
from ...models import Chapter, Character


CONTINUE_PROMPT = """你是一个专业的小说续写助手，擅长创作连贯、引人入胜的后续内容。

## 你的任务
根据前文继续创作后续内容。

## 输出要求
- 保持与前文一致的风格、语气和叙事节奏
- 情节发展自然流畅，符合已建立的人物性格和世界观
- 适当设置悬念，为后续发展埋下伏笔
- 保持适度篇幅（500-2000字）
- 直接输出续写内容，不要添加解释说明

## 格式
直接输出续写内容，不要添加标题或分隔符。"""


async def continue_node(state: AgentState) -> AgentState:
    user_input = state["messages"][-1].content
    project_id = state.get("project_id")
    chapter_id = state.get("chapter_id")

    context_parts = []
    if chapter_id:
        async with async_session() as session:
            result = await session.execute(select(Chapter).where(Chapter.id == chapter_id))
            chapter = result.scalar_one_or_none()
            if chapter:
                context_parts.append(f"=== 当前章节: {chapter.title} ===")
                context_parts.append(chapter.content)

    if not context_parts and project_id:
        async with async_session() as session:
            result = await session.execute(
                select(Chapter)
                .where(Chapter.project_id == project_id)
                .order_by(Chapter.sort_order.desc())
                .limit(3)
            )
            chapters = result.scalars().all()
            for ch in reversed(chapters):
                context_parts.append(f"=== {ch.title} ===")
                context_parts.append(ch.content)

    from ...utils.chat_model import create_execution_model
    llm = create_execution_model()

    user_msg = f"""用户要求: {user_input}

--- 前文内容 ---
{'='.join(context_parts)}
---

请续写前文，输出后续内容。"""

    response = await llm.invoke([
        SystemMessage(content=CONTINUE_PROMPT),
        HumanMessage(content=user_msg),
    ])

    return {
        **state,
        "generated_content": response.content,
        "active_agent": "continue",
        "tools_executed": state.get("tools_executed", []) + ["continue_story"],
    }