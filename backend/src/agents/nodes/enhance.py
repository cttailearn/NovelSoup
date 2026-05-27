from langchain_core.messages import HumanMessage, SystemMessage
from sqlalchemy import select
from ..state import AgentState
from ...utils.database import async_session
from ...models import Chapter


ENHANCE_PROMPT = """你是一个专业的文学写作助手，擅长丰富段落描写。

## 你的任务
对用户选中的段落进行加料/增强，丰富以下方面：
- 环境描写（光线、天气、氛围、场景细节）
- 心理描写（内心活动、情感波动、思维变化）
- 动作描写（肢体动作、微表情、行为细节）
- 对话描写（语气、停顿、潜台词）
- 感官描写（视觉、听觉、嗅觉、触觉、味觉）

## 输出要求
- 保持原文的核心情节和意图
- 添加的描写要自然流畅，与原文风格一致
- 输出完整的加料后段落（包含原文+新增内容）
- 不要添加过多的修辞，保持适度

## 格式
直接输出加料后的完整段落，不要添加解释说明。"""


async def enhance_node(state: AgentState) -> AgentState:
    user_input = state["messages"][-1].content
    selected_text = state.get("selected_text", "")
    project_id = state.get("project_id")
    chapter_id = state.get("chapter_id")

    context = ""
    if chapter_id:
        async with async_session() as session:
            result = await session.execute(select(Chapter).where(Chapter.id == chapter_id))
            chapter = result.scalar_one_or_none()
            if chapter:
                context = f"=== 当前章节: {chapter.title} ===\n{chapter.content[:2000]}\n\n"

    from ...utils.chat_model import create_execution_model
    llm = create_execution_model()

    user_msg = f"""{context}用户要求: {user_input}

选中要加料的段落:
---
{selected_text or user_input}
---

请按照要求对段落进行加料/增强。"""

    response = await llm.invoke([
        SystemMessage(content=ENHANCE_PROMPT),
        HumanMessage(content=user_msg),
    ])

    return {
        **state,
        "generated_content": response.content,
        "active_agent": "enhance",
        "tools_executed": state.get("tools_executed", []) + ["enhance_passage"],
    }