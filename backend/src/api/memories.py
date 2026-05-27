from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime
import uuid

from ..models import Memory
from ..schemas import MemoryCreate, MemoryResponse
from ..utils.database import get_db

router = APIRouter(prefix="/memories", tags=["memories"])


@router.get("/project/{project_id}", response_model=list[MemoryResponse])
async def list_memories(project_id: str, db: AsyncSession = Depends(get_db)):
    isolation_key = f"project:{project_id}"
    result = await db.execute(
        select(Memory)
        .where(Memory.isolation_key == isolation_key)
        .order_by(Memory.create_time.desc())
    )
    memories = result.scalars().all()
    return memories


@router.post("/", response_model=MemoryResponse)
async def create_memory(data: MemoryCreate, db: AsyncSession = Depends(get_db)):
    now = int(datetime.now().timestamp() * 1000)
    memory = Memory(
        id=str(uuid.uuid4()),
        isolation_key=data.isolation_key,
        type=data.type,
        role=data.role,
        name=data.name,
        content=data.content,
        chapter_id=data.chapter_id,
        create_time=now,
    )
    db.add(memory)
    await db.commit()
    await db.refresh(memory)

    from ..utils import add_memory
    try:
        add_memory(
            id=memory.id,
            content=memory.content[:1000],
            metadata={
                "isolation_key": memory.isolation_key,
                "type": memory.type or "",
                "role": memory.role or "",
                "name": memory.name or "",
            },
        )
    except Exception:
        pass

    return memory


@router.delete("/{memory_id}")
async def delete_memory_route(memory_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Memory).where(Memory.id == memory_id))
    memory = result.scalar_one_or_none()
    if not memory:
        raise HTTPException(status_code=404, detail="Memory not found")

    await db.delete(memory)
    await db.commit()

    from ..utils import delete_memory as delete_vector_memory
    try:
        delete_vector_memory(memory_id)
    except Exception:
        pass

    return {"success": True}


@router.post("/clear/{project_id}")
async def clear_memories(project_id: str, db: AsyncSession = Depends(get_db)):
    isolation_key = f"project:{project_id}"
    result = await db.execute(
        select(Memory).where(Memory.isolation_key == isolation_key)
    )
    memories = result.scalars().all()
    memory_ids = [m.id for m in memories]

    for memory in memories:
        await db.delete(memory)

    await db.commit()

    from ..utils import delete_memory as delete_vector_memory
    for mid in memory_ids:
        try:
            delete_vector_memory(mid)
        except Exception:
            pass

    return {"success": True, "deleted": len(memories)}