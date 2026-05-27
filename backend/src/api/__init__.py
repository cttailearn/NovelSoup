from .projects import router as projects_router
from .chapters import router as chapters_router
from .characters import router as characters_router
from .memories import router as memories_router
from .skills import router as skills_router

__all__ = [
    "projects_router",
    "chapters_router",
    "characters_router",
    "memories_router",
    "skills_router",
]