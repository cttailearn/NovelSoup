from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime
import uuid
import json

from ..models import Character
from ..schemas import CharacterCreate, CharacterUpdate, CharacterResponse
from ..utils.database import get_db

router = APIRouter(prefix="/characters", tags=["characters"])


@router.get("/project/{project_id}", response_model=list[CharacterResponse])
async def list_characters(project_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Character)
        .where(Character.project_id == project_id)
        .order_by(Character.create_time)
    )
    characters = result.scalars().all()
    return characters


@router.post("/", response_model=CharacterResponse)
async def create_character(data: CharacterCreate, db: AsyncSession = Depends(get_db)):
    now = int(datetime.now().timestamp() * 1000)
    character = Character(
        id=str(uuid.uuid4()),
        project_id=data.project_id,
        name=data.name,
        aliases=json.dumps(data.aliases) if data.aliases else "[]",
        description=data.description,
        traits=json.dumps(data.traits) if data.traits else "{}",
        relations=json.dumps(data.relations) if data.relations else "{}",
        status=data.status,
        create_time=now,
        update_time=now,
    )
    db.add(character)
    await db.commit()
    await db.refresh(character)
    return character


@router.get("/{character_id}", response_model=CharacterResponse)
async def get_character(character_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Character).where(Character.id == character_id))
    character = result.scalar_one_or_none()
    if not character:
        raise HTTPException(status_code=404, detail="Character not found")
    return character


@router.put("/{character_id}", response_model=CharacterResponse)
async def update_character(
    character_id: str,
    data: CharacterUpdate,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Character).where(Character.id == character_id))
    character = result.scalar_one_or_none()
    if not character:
        raise HTTPException(status_code=404, detail="Character not found")

    if data.name is not None:
        character.name = data.name
    if data.aliases is not None:
        character.aliases = json.dumps(data.aliases)
    if data.description is not None:
        character.description = data.description
    if data.traits is not None:
        character.traits = json.dumps(data.traits)
    if data.relations is not None:
        character.relations = json.dumps(data.relations)
    if data.status is not None:
        character.status = data.status
    character.update_time = int(datetime.now().timestamp() * 1000)

    await db.commit()
    await db.refresh(character)
    return character


@router.delete("/{character_id}")
async def delete_character(character_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Character).where(Character.id == character_id))
    character = result.scalar_one_or_none()
    if not character:
        raise HTTPException(status_code=404, detail="Character not found")

    await db.delete(character)
    await db.commit()
    return {"success": True}