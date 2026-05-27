from pydantic_settings import BaseSettings, SettingsConfigDict
from pathlib import Path


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

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


settings = Settings()

BACKEND_DIR = Path(__file__).parent.parent
DATA_DIR = BACKEND_DIR / "data"
SKILLS_DIR = DATA_DIR / "skills"
DB_PATH = DATA_DIR / "novel_soup.db"
VECTOR_DB_PATH = DATA_DIR / "vectors.db"