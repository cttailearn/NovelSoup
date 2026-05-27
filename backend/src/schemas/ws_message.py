from pydantic import BaseModel
from typing import Optional, Literal


class ChatMessage(BaseModel):
    event: Literal["chat", "cancel"]
    text: str = ""
    project_id: Optional[str] = None
    chapter_id: Optional[str] = None
    selected_text: Optional[str] = None
    action: Optional[str] = None


class WsMessage(BaseModel):
    type: Literal[
        "content:update", "done", "error", "agent_start", "agent_complete", 
        "tool_call", "tool_result", "thinking", "review"
    ]
    content: Optional[str] = None
    agent: Optional[str] = None
    tool_name: Optional[str] = None
    tool_args: Optional[dict] = None
    tool_result: Optional[str] = None
    review: Optional[dict] = None
    error: Optional[str] = None