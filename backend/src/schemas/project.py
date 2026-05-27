from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class ProjectBase(BaseModel):
    title: str
    author: Optional[str] = None
    description: Optional[str] = None
    style: Optional[str] = None


class ProjectCreate(ProjectBase):
    pass


class ProjectUpdate(BaseModel):
    title: Optional[str] = None
    author: Optional[str] = None
    description: Optional[str] = None
    style: Optional[str] = None


class ProjectResponse(ProjectBase):
    id: str
    create_time: int
    update_time: int

    class Config:
        from_attributes = True