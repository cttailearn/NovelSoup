from langgraph.graph import StateGraph, END
from langchain_core.runnables import RunnablePassthrough
from typing import Literal, Optional
from .state import AgentState, create_initial_state
from .nodes import (
    decision_node,
    enhance_node,
    continue_node,
    rewrite_node,
    supervision_node,
    supervisor_node,
    should_continue,
    route_decision,
)

graph = StateGraph(AgentState)

graph.add_node("decision", decision_node)
graph.add_node("enhance", enhance_node)
graph.add_node("continue", continue_node)
graph.add_node("rewrite", rewrite_node)
graph.add_node("supervision", supervision_node)
graph.add_node("supervisor", supervisor_node)

graph.add_edge("__start__", "decision")
graph.add_conditional_edges(
    "decision",
    route_decision,
    {"enhance": "enhance", "continue": "continue", "rewrite": "rewrite"},
)

graph.add_edge("enhance", "supervision")
graph.add_edge("continue", "supervision")
graph.add_edge("rewrite", "supervision")
graph.add_edge("supervision", "supervisor")
graph.add_conditional_edges(
    "supervisor",
    should_continue,
    {"correct": "decision", "end": END},
)

novel_agent = graph.compile()


class AgentStream:
    def __init__(self, agent):
        self.agent = agent

    async def stream(self, input_state: dict):
        try:
            async for chunk in self.agent.astream(input_state):
                yield chunk
        except Exception as e:
            yield {"error": str(e)}

    async def astream(self, input_state: dict):
        async for chunk in self.agent.astream(input_state):
            yield chunk


agent_stream = AgentStream(novel_agent)


async def run_agent(
    user_input: str,
    project_id: str = None,
    chapter_id: str = None,
    selected_text: str = None,
    skill_names: list[str] = None,
):
    initial_state = create_initial_state(
        user_input=user_input,
        project_id=project_id,
        chapter_id=chapter_id,
        selected_text=selected_text,
    )
    if skill_names:
        initial_state["skill_names"] = skill_names

    async for chunk in agent_stream.stream(initial_state):
        yield chunk


async def stream_agent(
    user_input: str,
    project_id: str = None,
    chapter_id: str = None,
    selected_text: str = None,
    skill_names: list[str] = None,
):
    initial_state = create_initial_state(
        user_input=user_input,
        project_id=project_id,
        chapter_id=chapter_id,
        selected_text=selected_text,
    )
    if skill_names:
        initial_state["skill_names"] = skill_names

    buffer = ""

    async for chunk in novel_agent.astream(initial_state, stream_mode="values"):
        if "messages" in chunk:
            last_msg = chunk["messages"][-1]
            if hasattr(last_msg, "content") and last_msg.content:
                content = last_msg.content
                if not (content.startswith("{") and '"agent"' in content):
                    buffer = content
                    yield {"type": "content", "content": content}

        if "active_agent" in chunk:
            yield {"type": "agent", "agent": chunk["active_agent"]}

        if "supervision_grade" in chunk:
            yield {"type": "review", "grade": chunk["supervision_grade"]}

    yield {"type": "done", "content": buffer}