from langchain_core.messages import HumanMessage, SystemMessage
from ..state import AgentState


REWRITE_PROMPT = """你是一个专业的文学改写助手，擅长用不同的风格、视角和技巧重写文本。

## 你的任务
根据用户指定的方式改写文本。

## 改写方式（根据用户输入判断）
- 风格改写：改为简洁/华丽/古典/现代等风格
- 视角改写：第一人称/第三人称全知/第三人称限定
- 节奏改写：加快节奏/放慢节奏
- 语气改写：严肃/幽默/温情/冷峻等

## 输出要求
- 严格按照用户指定的方式进行改写
- 保持原文的核心信息和情节
- 直接输出改写后的完整内容，不要添加解释说明

## 格式
直接输出改写后的内容。"""


async def rewrite_node(state: AgentState) -> AgentState:
    user_input = state["messages"][-1].content
    selected_text = state.get("selected_text", "")

    rewrite_hint = ""
    if "风格" in user_input or "风格" in selected_text:
        rewrite_hint = "请用指定的风格改写文本"
    elif "视角" in user_input or "人称" in user_input:
        rewrite_hint = "请用指定的视角改写文本"
    elif "节奏" in user_input or "节奏" in user_input:
        rewrite_hint = "请调整文本的叙事节奏"
    else:
        rewrite_hint = "请按用户要求改写文本"

    from ...utils.chat_model import create_execution_model
    llm = create_execution_model()

    user_msg = f"""用户要求: {user_input}

{rewrite_hint}:
---
{selected_text or user_input}
---

请直接输出改写后的内容。"""

    response = await llm.invoke([
        SystemMessage(content=REWRITE_PROMPT),
        HumanMessage(content=user_msg),
    ])

    return {
        **state,
        "generated_content": response.content,
        "active_agent": "rewrite",
        "tools_executed": state.get("tools_executed", []) + ["rewrite_passage"],
    }