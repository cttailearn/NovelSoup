from pydantic_settings import BaseSettings, SettingsConfigDict
from pathlib import Path


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    openai_api_key: str = ""
    openai_base_url: str = "https://api.openai.com/v1"
    openai_model: str = "gpt-4o"

    deepseek_api_key: str = ""
    deepseek_base_url: str = "https://api.deepseek.com/v1"
    deepseek_model: str = "deepseek-chat"

    anthropic_api_key: str = ""
    anthropic_base_url: str = "https://api.minimaxi.com/anthropic"
    anthropic_model: str = "MiniMax-M2.7"

    llm_api_key: str = ""
    llm_base_url: str = "https://api.openai.com/v1"
    llm_model: str = "gpt-4o"

    database_url: str = "sqlite+aiosqlite:///./data/novel_soup.db"

    embedding_model: str = "sentence-transformers/all-MiniLM-L6-v2"
    device: str = "cpu"

    cors_origins: str = "http://localhost:5173"
    log_level: str = "INFO"

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",")]

    def get_active_llm_config(self) -> tuple[str, str, str]:
        if self.anthropic_api_key:
            return self.anthropic_api_key, self.anthropic_base_url, self.anthropic_model
        if self.deepseek_api_key:
            return self.deepseek_api_key, self.deepseek_base_url, self.deepseek_model
        if self.openai_api_key:
            return self.openai_api_key, self.openai_base_url, self.openai_model
        if self.llm_api_key:
            return self.llm_api_key, self.llm_base_url, self.llm_model
        return self.llm_api_key, self.llm_base_url, self.llm_model


settings = Settings()

BACKEND_DIR = Path(__file__).parent.parent
DATA_DIR = BACKEND_DIR / "data"
SKILLS_DIR = DATA_DIR / "skills"
DB_PATH = DATA_DIR / "novel_soup.db"
VECTOR_DB_PATH = DATA_DIR / "vectors.db"
