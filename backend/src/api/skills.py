from fastapi import APIRouter
from pathlib import Path
from typing import Optional

from ..utils.skills_loader import skills_loader

router = APIRouter(prefix="/skills", tags=["skills"])


@router.get("/")
async def list_skills(category: Optional[str] = None):
    return skills_loader.list_skills(category=category)


@router.get("/{name}")
async def get_skill(name: str):
    skill = skills_loader.load_skill(name)
    if not skill:
        return {"error": "Skill not found"}, 404
    return skill