from typing import Annotated, Literal, Optional
from typing_extensions import TypedDict
from langgraph.graph import add_messages
from langchain_core.messages import BaseMessage


class AgentState(TypedDict):
    messages: Annotated[list[BaseMessage], add_messages]
    selected_text: Optional[str]
    project_id: Optional[str]
    chapter_id: Optional[str]
    generated_content: Optional[str]
    supervision_grade: Optional[Literal["A", "B", "C", "D"]]
    supervision_loop_count: int
    active_agent: Optional[Literal["decision", "enhance", "continue", "rewrite", "supervision"]]
    tools_executed: list[str]
    skill_names: list[str]
    action: Optional[str]


def create_initial_state(
    user_input: str,
    project_id: Optional[str] = None,
    chapter_id: Optional[str] = None,
    selected_text: Optional[str] = None,
) -> AgentState:
    return AgentState(
        messages=[{"role": "user", "content": user_input}],
        selected_text=selected_text,
        project_id=project_id,
        chapter_id=chapter_id,
        generated_content=None,
        supervision_grade=None,
        supervision_loop_count=0,
        active_agent=None,
        tools_executed=[],
        skill_names=[],
        action=None,
    )