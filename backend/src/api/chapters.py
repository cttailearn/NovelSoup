from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from datetime import datetime
import uuid
import json
import re

from ..models import Chapter, Project
from ..schemas import ChapterCreate, ChapterUpdate, ChapterResponse
from ..utils.database import get_db

router = APIRouter(prefix="/chapters", tags=["chapters"])


@router.get("/project/{project_id}", response_model=list[ChapterResponse])
async def list_chapters(project_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Chapter)
        .where(Chapter.project_id == project_id)
        .order_by(Chapter.sort_order)
    )
    chapters = result.scalars().all()
    return chapters


@router.post("/", response_model=ChapterResponse)
async def create_chapter(data: ChapterCreate, db: AsyncSession = Depends(get_db)):
    now = int(datetime.now().timestamp() * 1000)
    chapter = Chapter(
        id=str(uuid.uuid4()),
        project_id=data.project_id,
        title=data.title,
        content=data.content,
        sort_order=data.sort_order,
        word_count=data.word_count or len(data.content) if data.content else 0,
        summary=data.summary,
        create_time=now,
        update_time=now,
    )
    db.add(chapter)
    await db.commit()
    await db.refresh(chapter)
    return chapter


@router.get("/{chapter_id}", response_model=ChapterResponse)
async def get_chapter(chapter_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Chapter).where(Chapter.id == chapter_id))
    chapter = result.scalar_one_or_none()
    if not chapter:
        raise HTTPException(status_code=404, detail="Chapter not found")
    return chapter


@router.put("/{chapter_id}", response_model=ChapterResponse)
async def update_chapter(
    chapter_id: str,
    data: ChapterUpdate,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Chapter).where(Chapter.id == chapter_id))
    chapter = result.scalar_one_or_none()
    if not chapter:
        raise HTTPException(status_code=404, detail="Chapter not found")

    if data.title is not None:
        chapter.title = data.title
    if data.content is not None:
        chapter.content = data.content
        chapter.word_count = len(data.content)
    if data.sort_order is not None:
        chapter.sort_order = data.sort_order
    if data.word_count is not None:
        chapter.word_count = data.word_count
    if data.summary is not None:
        chapter.summary = data.summary
    chapter.update_time = int(datetime.now().timestamp() * 1000)

    await db.commit()
    await db.refresh(chapter)
    return chapter


@router.delete("/{chapter_id}")
async def delete_chapter(chapter_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Chapter).where(Chapter.id == chapter_id))
    chapter = result.scalar_one_or_none()
    if not chapter:
        raise HTTPException(status_code=404, detail="Chapter not found")

    await db.delete(chapter)
    await db.commit()
    return {"success": True}


PARSE_RULES = [
    {"pattern": r"^(第[一二三四五六七八九十百千零\d]+章)\s*", "name": "第X章"},
    {"pattern": r"^(第[一二三四五六七八九十百千零\d]+回)\s*", "name": "第X回"},
    {"pattern": r"^(Chapter\s+\d+)\s*[:\.\-]?", "name": "Chapter X"},
    {"pattern": r"^(卷[一二三四五六七八九十百千零\d]+[-－]\s*[第篇部][^\n]+)\s*", "name": "卷X-章节"},
]


def parse_chapters_from_text(text: str) -> list[dict]:
    chapters = []
    lines = text.split("\n")
    current_title = None
    current_content_lines = []

    for line in lines:
        matched = False
        for rule in PARSE_RULES:
            match = re.match(rule["pattern"], line)
            if match:
                if current_title is not None:
                    content = "\n".join(current_content_lines).strip()
                    if content:
                        chapters.append({
                            "title": current_title,
                            "content": content,
                        })
                current_title = match.group(1)
                current_content_lines = []
                rest = line[match.end():].strip()
                if rest:
                    current_content_lines.append(rest)
                matched = True
                break

        if not matched:
            current_content_lines.append(line)

    if current_title is not None:
        content = "\n".join(current_content_lines).strip()
        if content:
            chapters.append({
                "title": current_title,
                "content": content,
            })

    if not chapters and text.strip():
        chapters.append({
            "title": "全文",
            "content": text.strip(),
        })

    return chapters


@router.post("/upload")
async def upload_chapters(
    project_id: str,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    content = await file.read()
    try:
        text = content.decode("utf-8")
    except UnicodeDecodeError:
        text = content.decode("gbk", errors="replace")

    parsed = parse_chapters_from_text(text)
    if not parsed:
        raise HTTPException(status_code=400, detail="No chapters parsed from file")

    now = int(datetime.now().timestamp() * 1000)
    result = await db.execute(
        select(func.max(Chapter.sort_order))
        .where(Chapter.project_id == project_id)
    )
    max_order = result.scalar() or 0

    chapters = []
    for i, p in enumerate(parsed):
        chapter = Chapter(
            id=str(uuid.uuid4()),
            project_id=project_id,
            title=p["title"],
            content=p["content"],
            sort_order=max_order + i + 1,
            word_count=len(p["content"]),
            create_time=now,
            update_time=now,
        )
        db.add(chapter)
        chapters.append(chapter)

    await db.commit()
    for chapter in chapters:
        await db.refresh(chapter)

    return {"chapters": chapters}


class ChapterBatchItem(BaseModel):
    title: str
    content: str
    sort_order: int


class ChapterBatchUploadRequest(BaseModel):
    projectId: str
    chapters: list[ChapterBatchItem]


@router.post("/batch")
async def batch_create_chapters(
    data: ChapterBatchUploadRequest,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Project).where(Project.id == data.projectId))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    now = int(datetime.now().timestamp() * 1000)
    chapters = []
    for p in data.chapters:
        chapter = Chapter(
            id=str(uuid.uuid4()),
            project_id=data.projectId,
            title=p.title,
            content=p.content,
            sort_order=p.sort_order,
            word_count=len(p.content),
            create_time=now,
            update_time=now,
        )
        db.add(chapter)
        chapters.append(chapter)

    await db.commit()
    for chapter in chapters:
        await db.refresh(chapter)

    return {"chapters": chapters}