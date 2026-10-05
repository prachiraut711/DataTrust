from functools import lru_cache
from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "DataTrust API"
    PROJECT_VERSION: str = "0.1.0"
    API_PREFIX: str = "/api"
    ENVIRONMENT: str = "development"

    # PostgreSQL Database URL
    DATABASE_URL: str = "postgresql://datatrust_user:datatrust_password@localhost:5432/datatrust_db"

    # Allowed CORS Origins
    CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
