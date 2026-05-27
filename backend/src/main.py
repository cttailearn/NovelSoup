from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import uuid

from .utils.database import init_db
from .utils import settings
from .api import (
    projects_router,
    chapters_router,
    characters_router,
    memories_router,
    skills_router,
)
from .ws import websocket_handler


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield


app = FastAPI(
    title="NovelSoup API",
    description="AI-powered novel writing assistant backend",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(projects_router, prefix="/api/v1")
app.include_router(chapters_router, prefix="/api/v1")
app.include_router(characters_router, prefix="/api/v1")
app.include_router(memories_router, prefix="/api/v1")
app.include_router(skills_router, prefix="/api/v1")


@app.websocket("/ws/novel")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    client_id = str(uuid.uuid4())
    await websocket_handler(websocket, client_id)


@app.get("/")
async def root():
    return {"message": "NovelSoup API", "version": "0.1.0"}


@app.get("/health")
async def health():
    return {"status": "healthy"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)