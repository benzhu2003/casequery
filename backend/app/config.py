from functools import lru_cache
from os import getenv


class Settings:
    database_url: str = getenv(
        "DATABASE_URL",
        "postgresql://casequery:casequery_password@localhost:5432/casequery",
    )
    cors_origins: list[str] = [
        item.strip()
        for item in getenv("CORS_ORIGINS", "http://localhost:8080").split(",")
        if item.strip()
    ]


@lru_cache
def get_settings() -> Settings:
    return Settings()
