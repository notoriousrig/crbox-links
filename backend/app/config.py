"""Application configuration loaded from environment."""
from __future__ import annotations

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "sqlite:////data/links.db"
    data_dir: str = "/data"
    favicon_dir: str = "/data/favicons"

    # Cloudflare Access. If aud is empty we skip JWT verification (local dev).
    cf_access_team_domain: str = ""
    cf_access_aud: str = ""

    # Nightly jobs (server local time, 0-23)
    linkcheck_hour: int = 3
    backup_hour: int = 4
    backup_keep_days: int = 30

    log_level: str = "INFO"


settings = Settings()
