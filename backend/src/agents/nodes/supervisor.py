from ..state import AgentState
from typing import Literal


def supervisor_node(state: AgentState) -> AgentState:
    grade = state.get("supervision_grade", "C")
    loop_count = state.get("supervision_loop_count", 0)

    return {
        **state,
        "supervision_loop_count": loop_count + 1,
    }


def should_continue(state: AgentState) -> Literal["end", "correct"]:
    grade = state.get("supervision_grade", "C")
    loop_count = state.get("supervision_loop_count", 0)

    if loop_count >= 2:
        return "end"
    if grade in ["A", "B"]:
        return "end"
    return "correct"


def route_decision(state: AgentState) -> Literal["enhance", "continue", "rewrite"]:
    action = state.get("action", "continue")
    if action == "enhance":
        return "enhance"
    elif action == "rewrite":
        return "rewrite"
    else:
        return "continue"