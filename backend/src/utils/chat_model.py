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
    api_key, base_url, default_model = settings.get_active_llm_config()

    if not api_key:
        raise ValueError("No LLM API Key configured. Please check your .env file.")

    model = model_name or default_model

    base_url_formatted = base_url.rstrip("/")
    if not base_url_formatted.endswith("/v1"):
        base_url_formatted += "/v1"

    return ChatOpenAI(
        model=model,
        api_key=api_key,
        base_url=base_url_formatted,
        streaming=streaming,
        temperature=temperature,
    )


def create_decision_model() -> BaseChatModel:
    return create_chat_model(streaming=True, temperature=0.7)


def create_execution_model() -> BaseChatModel:
    return create_chat_model(streaming=False, temperature=0.7)


def create_supervision_model() -> BaseChatModel:
    return create_chat_model(streaming=False, temperature=0.3)
