from langchain_openai import ChatOpenAI
from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.messages import BaseMessage
from langchain_core.outputs import ChatResult, ChatGeneration
from langchain_core.callbacks import CallbackManagerForLLMRun
from typing import Optional, Any, Iterator, List

from ..utils import settings


def create_chat_model(
    model_name: Optional[str] = None,
    streaming: bool = True,
    temperature: float = 0.7,
) -> BaseChatModel:
    api_key = settings.llm_api_key
    if not api_key:
        raise ValueError("LLM_API_KEY not configured")

    base_url = settings.llm_base_url
    model = model_name or settings.llm_model

    return ChatOpenAI(
        model=model,
        api_key=api_key,
        base_url=base_url.rstrip("/") + "/v1" if not base_url.endswith("/v1") else base_url,
        streaming=streaming,
        temperature=temperature,
    )


def create_decision_model() -> BaseChatModel:
    return create_chat_model(streaming=True, temperature=0.7)


def create_execution_model() -> BaseChatModel:
    return create_chat_model(streaming=True, temperature=0.7)


def create_supervision_model() -> BaseChatModel:
    return create_chat_model(streaming=False, temperature=0.3)