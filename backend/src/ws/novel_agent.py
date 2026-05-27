from fastapi import WebSocket, WebSocketDisconnect
from .connection import manager
from ..agents import run_agent
from typing import Optional


async def handle_chat_event(websocket: WebSocket, data: dict):
    user_input = data.get("text", "")
    project_id = data.get("project_id")
    chapter_id = data.get("chapter_id")
    selected_text = data.get("selected_text")
    skill_names = data.get("skill_names", [])

    if not user_input:
        await websocket.send_json({
            "type": "error",
            "error": "Empty input",
        })
        return

    try:
        buffer = ""
        async for chunk in run_agent(
            user_input=user_input,
            project_id=project_id,
            chapter_id=chapter_id,
            selected_text=selected_text,
            skill_names=skill_names,
        ):
            if "messages" in chunk:
                last_msg = chunk["messages"][-1]
                if hasattr(last_msg, "content") and last_msg.content:
                    content = last_msg.content
                    if content.startswith("{") and '"agent"' in content:
                        continue
                    buffer = content
                    await websocket.send_json({
                        "type": "content:update",
                        "content": content,
                        "agent": chunk.get("active_agent", "assistant"),
                    })
            elif "active_agent" in chunk:
                await websocket.send_json({
                    "type": "agent_start",
                    "agent": chunk["active_agent"],
                    "content": f"执行 {chunk['active_agent']}...",
                })
            elif "supervision_grade" in chunk:
                grade = chunk.get("supervision_grade")
                await websocket.send_json({
                    "type": "review",
                    "review": {
                        "grade": grade,
                        "summary": f"质量评级: {grade}",
                    },
                })

        await websocket.send_json({"type": "done", "content": buffer})

    except Exception as e:
        await websocket.send_json({
            "type": "error",
            "error": str(e),
        })


async def websocket_handler(websocket: WebSocket, client_id: str):
    await manager.connect(client_id, websocket)

    try:
        while True:
            data = await websocket.receive_json()
            event = data.get("event")

            if event == "chat":
                await handle_chat_event(websocket, data)
            elif event == "cancel":
                await websocket.send_json({
                    "type": "done",
                    "content": "已取消",
                })
            else:
                await websocket.send_json({
                    "type": "error",
                    "error": f"Unknown event: {event}",
                })

    except WebSocketDisconnect:
        manager.disconnect(client_id)
    except Exception as e:
        await websocket.send_json({
            "type": "error",
            "error": str(e),
        })
        manager.disconnect(client_id)