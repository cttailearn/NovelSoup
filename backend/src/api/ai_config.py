from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from datetime import datetime
import uuid

from ..models import AIConfig
from ..utils.database import get_db
from ..utils import settings

router = APIRouter(prefix="/ai-config", tags=["ai-config"])


@router.get("/defaults")
async def get_default_config():
    api_key, base_url, model = settings.get_active_llm_config()
    return {
        "api_key": api_key or "",
        "base_url": base_url or "https://api.openai.com/v1",
        "model": model or "gpt-4o",
        "temperature": "0.7",
        "max_tokens": 4000,
    }


@router.post("/test-connection")
async def test_connection(data: dict):
    from langchain_openai import ChatOpenAI

    api_key = data.get("api_key", "")
    base_url = data.get("base_url", "https://api.openai.com/v1")
    model = data.get("model", "gpt-4o")

    if not api_key:
        return {"success": False, "error": "API Key 不能为空"}

    try:
        base_url_formatted = base_url.rstrip("/") + "/v1" if not base_url.endswith("/v1") else base_url

        llm = ChatOpenAI(
            model=model,
            api_key=api_key,
            base_url=base_url_formatted,
            temperature=0.7,
        )

        response = llm.invoke("你好，请回复 OK")
        content = response.content if hasattr(response, 'content') else str(response)

        if "OK" in content or "ok" in content:
            return {"success": True, "message": "连接成功"}
        else:
            return {"success": True, "message": "连接成功，模型响应正常"}
    except Exception as e:
        return {"success": False, "error": str(e)}


@router.get("/")
async def list_configs(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(AIConfig).order_by(AIConfig.create_time.desc()))
    configs = result.scalars().all()
    return configs


@router.post("/")
async def create_config(data: dict, db: AsyncSession = Depends(get_db)):
    now = int(datetime.now().timestamp() * 1000)
    config = AIConfig(
        id=str(uuid.uuid4()),
        name=data.get("name", ""),
        category=data.get("category"),
        api_key=data.get("api_key"),
        base_url=data.get("base_url"),
        model=data.get("model"),
        temperature=str(data.get("temperature", "0.7")),
        max_tokens=data.get("max_tokens"),
        is_active=data.get("is_active", False),
        is_system=False,
        create_time=now,
        update_time=now,
    )
    db.add(config)
    await db.commit()
    await db.refresh(config)
    return config


@router.get("/{config_id}")
async def get_config(config_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(AIConfig).where(AIConfig.id == config_id))
    config = result.scalar_one_or_none()
    if not config:
        raise HTTPException(status_code=404, detail="Config not found")
    return config


@router.put("/{config_id}")
async def update_config(config_id: str, data: dict, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(AIConfig).where(AIConfig.id == config_id))
    config = result.scalar_one_or_none()
    if not config:
        raise HTTPException(status_code=404, detail="Config not found")

    if config.is_system and not data.get("is_system", False):
        raise HTTPException(status_code=403, detail="Cannot modify system config")

    for field in ["name", "category", "api_key", "base_url", "model", "temperature", "max_tokens", "is_active"]:
        if field in data and data[field] is not None:
            setattr(config, field, data[field])
    config.update_time = int(datetime.now().timestamp() * 1000)

    await db.commit()
    await db.refresh(config)
    return config


@router.delete("/{config_id}")
async def delete_config(config_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(AIConfig).where(AIConfig.id == config_id))
    config = result.scalar_one_or_none()
    if not config:
        raise HTTPException(status_code=404, detail="Config not found")

    if config.is_system:
        raise HTTPException(status_code=403, detail="Cannot delete system config")

    await db.delete(config)
    await db.commit()
    return {"success": True}


@router.post("/activate/{config_id}")
async def activate_config(config_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(AIConfig).where(AIConfig.id == config_id))
    config = result.scalar_one_or_none()
    if not config:
        raise HTTPException(status_code=404, detail="Config not found")

    await db.execute(
        update(AIConfig).where(AIConfig.is_active == True).values(is_active=False)
    )

    config.is_active = True
    config.update_time = int(datetime.now().timestamp() * 1000)
    await db.commit()

    return {"success": True}


@router.post("/import-from-env")
async def import_from_env(db: AsyncSession = Depends(get_db)):
    api_key, base_url, model = settings.get_active_llm_config()
    if not api_key:
        return {"success": False, "error": "环境变量中未配置任何 API Key (OPENAI_API_KEY, DEEPSEEK_API_KEY, ANTHROPIC_API_KEY)"}

    existing = await db.execute(
        select(AIConfig).where(AIConfig.name == "Env 默认配置")
    )
    existing_config = existing.scalar_one_or_none()

    now = int(datetime.now().timestamp() * 1000)

    if existing_config:
        existing_config.api_key = api_key
        existing_config.base_url = base_url or "https://api.openai.com/v1"
        existing_config.model = model or "gpt-4o"
        existing_config.update_time = now
        await db.commit()
        await db.refresh(existing_config)
        return {"success": True, "config": existing_config}

    config = AIConfig(
        id=str(uuid.uuid4()),
        name="Env 默认配置",
        category="default",
        api_key=api_key,
        base_url=base_url or "https://api.openai.com/v1",
        model=model or "gpt-4o",
        temperature="0.7",
        max_tokens=4000,
        is_active=False,
        is_system=False,
        create_time=now,
        update_time=now,
    )
    db.add(config)
    await db.commit()
    await db.refresh(config)

    return {"success": True, "config": config}