from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from datetime import datetime
import uuid
import json
import re

from ..models import Chapter, Project, ProjectParseRule
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
    {"id": "1", "pattern": r"^(第[一二三四五六七八九十百千零\d]+章)\s*", "name": "第X章（中文）", "example": "第1章 开始的序幕"},
    {"id": "2", "pattern": r"^(第[一二三四五六七八九十百千零\d]+回)\s*", "name": "第X回（古风）", "example": "第一回 梦开始的地方"},
    {"id": "3", "pattern": r"^(Chapter\s+\d+)\s*[:\.\-]?", "name": "Chapter X（英文）", "example": "Chapter 1: Introduction"},
    {"id": "4", "pattern": r"^(Chapter\s+[A-Za-z]+\s+\d+)\s*[:\.\-]?", "name": "Chapter X 英文序数词", "example": "Chapter One 开始的序幕"},
    {"id": "5", "pattern": r"^(卷[一二三四五六七八九十百千零\d]+[-－]\s*[第篇部][^\n]+)\s*", "name": "卷X-章节（卷册）", "example": "卷一-第一章 序幕"},
    {"id": "6", "pattern": r"^([A-Z][A-Za-z\s]+[_-][^\n]+)\s*", "name": "XX_XX（下划线）", "example": "Chapter_1_The_Beginning"},
    {"id": "7", "pattern": r"^(第[一二三四五六七八九十百千零\d]+节)\s*", "name": "第X节", "example": "第一节 序章"},
    {"id": "8", "pattern": r"^(\d+\.\d+[\.\s].*)$", "name": "X.X.（数字编号）", "example": "1.1 开篇"},
    {"id": "9", "pattern": r"^(\d+[-－][^\n]+)\s*", "name": "X-（短横线）", "example": "1-第一章 开篇"},
    {"id": "10", "pattern": r"^【([^】]+)】\s*", "name": "【X】", "example": "【第一章】开篇"},
    {"id": "11", "pattern": r"^（([一二三四五六七八九十百千零\d]+)）\s*", "name": "（X）括号章节", "example": "（第一章）开篇"},
    {"id": "12", "pattern": r"^(第[一二三四五六七八九十百千零\d]+[部分篇部])", "name": "第一部分", "example": "第一部分 序幕"},
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


class ReParseRequest(BaseModel):
    content: str


def parse_chapters_with_rules(text: str, rules: list[dict]) -> list[dict]:
    chapters = []
    lines = text.split("\n")
    current_title = None
    current_content_lines = []

    for line in lines:
        matched = False
        for rule in rules:
            if not rule.get("enabled", True):
                continue
            try:
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
            except re.error:
                continue

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


@router.post("/reparse/{project_id}")
async def reparse_chapters(
    project_id: str,
    data: ReParseRequest,
    db: AsyncSession = Depends(get_db),
):
    project_result = await db.execute(select(Project).where(Project.id == project_id))
    project = project_result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    rules_result = await db.execute(
        select(ProjectParseRule)
        .where(ProjectParseRule.project_id == project_id)
        .order_by(ProjectParseRule.sort_order)
    )
    db_rules = list(rules_result.scalars().all())

    if db_rules:
        rules = [
            {
                "pattern": r.pattern,
                "name": r.name,
                "enabled": r.enabled,
            }
            for r in db_rules
        ]
    else:
        rules = PARSE_RULES

    parsed = parse_chapters_with_rules(data.content, rules)

    if not parsed:
        raise HTTPException(status_code=400, detail="No chapters parsed from content")

    return {
        "chapters": [
            {
                "title": p["title"],
                "content": p["content"],
                "word_count": len(p["content"]),
            }
            for p in parsed
        ],
        "rules": rules,
    }


class RuleItem(BaseModel):
    name: str
    pattern: str
    example: str = ""
    enabled: bool = True


class SaveRulesRequest(BaseModel):
    rules: list[RuleItem]


@router.get("/rules/{project_id}")
async def get_project_rules(project_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(ProjectParseRule)
        .where(ProjectParseRule.project_id == project_id)
        .order_by(ProjectParseRule.sort_order)
    )
    rules = result.scalars().all()

    if not rules:
        return {"rules": PARSE_RULES}

    return {
        "rules": [
            {
                "id": r.id,
                "name": r.name,
                "pattern": r.pattern,
                "example": r.example or "",
                "enabled": r.enabled,
            }
            for r in rules
        ]
    }


@router.put("/rules/{project_id}")
async def save_project_rules(
    project_id: str,
    data: SaveRulesRequest,
    db: AsyncSession = Depends(get_db),
):
    project_result = await db.execute(select(Project).where(Project.id == project_id))
    project = project_result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    await db.execute(
        select(ProjectParseRule)
        .where(ProjectParseRule.project_id == project_id)
    ).scalars().all()

    existing_result = await db.execute(
        select(ProjectParseRule)
        .where(ProjectParseRule.project_id == project_id)
    )
    existing_rules = list(existing_result.scalars().all())
    for r in existing_rules:
        await db.delete(r)

    now = int(datetime.now().timestamp() * 1000)
    for i, rule_data in enumerate(data.rules):
        rule = ProjectParseRule(
            id=str(uuid.uuid4()),
            project_id=project_id,
            name=rule_data.name,
            pattern=rule_data.pattern,
            example=rule_data.example,
            enabled=rule_data.enabled,
            sort_order=i,
            create_time=now,
            update_time=now,
        )
        db.add(rule)

    await db.commit()

    return {"success": True}