from fastapi import WebSocket, WebSocketDisconnect
from typing import Optional
import json
import asyncio


class ConnectionManager:
    def __init__(self):
        self.active_connections: dict[str, WebSocket] = {}

    async def connect(self, client_id: str, websocket: WebSocket):
        self.active_connections[client_id] = websocket

    def disconnect(self, client_id: str):
        if client_id in self.active_connections:
            del self.active_connections[client_id]

    async def send_json(self, client_id: str, data: dict):
        if client_id in self.active_connections:
            await self.active_connections[client_id].send_json(data)


manager = ConnectionManager()


class NovelStreamingHandler:
    def __init__(self, websocket: WebSocket):
        self.websocket = websocket
        self.buffer = ""
        self.agent_name = "assistant"

    async def on_llm_start(self, serialized, prompts, **kwargs):
        await self.websocket.send_json({
            "type": "thinking",
            "content": "正在思考...",
        })

    async def on_llm_new_token(self, token: str, **kwargs):
        self.buffer += token
        await self.websocket.send_json({
            "type": "content:update",
            "content": self.buffer,
            "agent": self.agent_name,
        })

    async def on_llm_end(self, response, **kwargs):
        await self.websocket.send_json({
            "type": "done",
            "content": self.buffer,
        })

    async def on_tool_start(self, serialized, input_str, **kwargs):
        tool_name = kwargs.get("name", "tool")
        await self.websocket.send_json({
            "type": "tool_call",
            "tool_name": tool_name,
            "tool_args": {},
        })

    async def on_tool_end(self, output, **kwargs):
        await self.websocket.send_json({
            "type": "tool_result",
            "tool_result": str(output)[:200],
        })

    async def on_agent_action(self, action, **kwargs):
        if hasattr(action, "tool"):
            await self.websocket.send_json({
                "type": "agent_start",
                "agent": action.tool,
                "content": f"执行 {action.tool}...",
            })

    async def on_agent_finish(self, output, **kwargs):
        await self.websocket.send_json({
            "type": "agent_complete",
            "content": "执行完成",
        })