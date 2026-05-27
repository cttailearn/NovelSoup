from pydantic import BaseModel
from typing import Optional


class MemoryBase(BaseModel):
    isolation_key: str
    type: str
    role: Optional[str] = None
    name: Optional[str] = None
    content: str
    chapter_id: Optional[str] = None


class MemoryCreate(MemoryBase):
    pass


class MemoryResponse(MemoryBase):
    id: str
    embedding: Optional[str] = None
    summarized: bool = False
    create_time: int

    class Config:
        from_attributes = True