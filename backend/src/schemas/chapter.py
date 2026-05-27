from pydantic import BaseModel, Field
from typing import Optional


class ChapterBase(BaseModel):
    title: str
    content: str = ""
    sort_order: int = 0
    word_count: Optional[int] = None
    summary: Optional[str] = None


class ChapterCreate(ChapterBase):
    project_id: str


class ChapterUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    sort_order: Optional[int] = None
    word_count: Optional[int] = None
    summary: Optional[str] = None


class ChapterResponse(ChapterBase):
    id: str
    project_id: str
    create_time: int
    update_time: int

    class Config:
        from_attributes = True