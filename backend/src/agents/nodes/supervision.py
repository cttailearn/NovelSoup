from langchain_core.messages import HumanMessage, SystemMessage, AIMessage
import json
import re
from ..state import AgentState


SUPERVISION_PROMPT = """你是一个专业的小说质量审核员。你的职责是评估AI生成内容的质量。

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
5. 用户意图：是否满足用户的创作需求

## 输出格式
请严格按以下JSON格式输出评估结果，不要添加任何解释：

```json
{
  "grade": "A",  // A/B/C/D
  "summary": "一句话总结评估结果",
  "details": "详细的评估说明，包括优点和不足"
}
```"""


async def supervision_node(state: AgentState) -> AgentState:
    generated_content = state.get("generated_content", "")
    project_id = state.get("project_id")
    chapter_id = state.get("chapter_id")
    action = state.get("action", "continue")

    from ...utils.chat_model import create_supervision_model
    llm = create_supervision_model()

    user_msg = f"""评估内容类型: {action}
评估内容:
---
{generated_content or "无内容生成"}
---

请按JSON格式输出评估结果。"""

    response = await llm.invoke([
        SystemMessage(content=SUPERVISION_PROMPT),
        HumanMessage(content=user_msg),
    ])

    content = response.content.strip()

    json_match = re.search(r"\{[^{}]*\"grade\"[^{}]*\}", content, re.DOTALL)
    if not json_match:
        json_match = re.search(r"```json\s*([\s\S]*?)\s*```", content)
        if json_match:
            try:
                result = json.loads(json_match.group(1))
            except json.JSONDecodeError:
                result = {"grade": "C", "summary": "解析失败", "details": content}
        else:
            result = {"grade": "C", "summary": "无法解析评估结果", "details": content}
    else:
        try:
            result = json.loads(json_match.group(0))
        except json.JSONDecodeError:
            result = {"grade": "C", "summary": "JSON解析失败", "details": content}

    return {
        **state,
        "supervision_grade": result.get("grade", "C"),
        "active_agent": "supervision",
        "messages": state["messages"] + [AIMessage(content=json.dumps(result))],
    }