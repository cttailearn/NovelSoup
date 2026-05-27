from pydantic import BaseModel
from typing import Optional


class CharacterBase(BaseModel):
    name: str
    aliases: Optional[str] = None
    description: Optional[str] = None
    traits: Optional[str] = None
    relations: Optional[str] = None
    status: str = "active"


class CharacterCreate(CharacterBase):
    project_id: str


class CharacterUpdate(BaseModel):
    name: Optional[str] = None
    aliases: Optional[str] = None
    description: Optional[str] = None
    traits: Optional[str] = None
    relations: Optional[str] = None
    status: Optional[str] = None


class CharacterResponse(CharacterBase):
    id: str
    project_id: str
    create_time: int
    update_time: int

    class Config:
        from_attributes = True