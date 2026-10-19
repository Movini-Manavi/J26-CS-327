from functools import lru_cache
from pathlib import Path
from typing import Annotated, Literal

from pydantic import field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict

# Relative paths (and .env) resolve from this folder, wherever uvicorn is started.
BASE_DIR = Path(__file__).resolve().parent

STAGES = ["none", "Trust-Building", "Isolation", "Desensitization", "Solicitation"]

STAGE_LEVEL = {
    "Trust-Building": "low",
    "Isolation": "medium",
    "Desensitization": "high",
    "Solicitation": "critical",
}

# Push notification text for guardians. Keep in sync with guardianMessage in
# facebook-clone/src/lib/grooming/stages.ts.
GUARDIAN_MESSAGES = {
    "Trust-Building": "Early warning sign: a message to your child tries to build a fast bond. Open the guardian page.",
    "Isolation": "Warning sign: a message asks your child to keep secrets or chat privately. Open the guardian page.",
    "Desensitization": "Serious warning sign: a message steers your child toward inappropriate topics. Open the guardian page.",
    "Solicitation": "Urgent: a message asks your child for photos, details or a meeting. Check in with your child now.",
}


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=BASE_DIR / ".env", extra="ignore")

    db_backend: Literal["sqlite"] = "sqlite"
    sqlite_path: str = "./data/grooming.db"

    demo_key: str = "demo-key"
    cors_origins: Annotated[list[str], NoDecode] = ["http://localhost:3000"]
    # Any localhost port is allowed for local dev; set empty in production.
    cors_origin_regex: str = r"^http://(localhost|127\.0\.0\.1)(:\d+)?$"

    # transformers = the fine-tuned model in MODEL_DIR; stub = keyword list (tests)
    classifier: Literal["transformers", "stub"] = "transformers"
    model_dir: str = "./best_model"
    max_length: int = 128

    alert_stages: Annotated[list[str], NoDecode] = STAGES[1:]

    vapid_public_key: str = ""
    vapid_private_key: str = ""
    vapid_subject: str = "mailto:demo@example.com"

    @field_validator("cors_origins", "alert_stages", mode="before")
    @classmethod
    def split_csv(cls, v):
        if isinstance(v, str):
            return [s.strip() for s in v.split(",") if s.strip()]
        return v

    @field_validator("sqlite_path", "model_dir")
    @classmethod
    def resolve_path(cls, v: str) -> str:
        if v == ":memory:" or Path(v).is_absolute():
            return v
        return str(BASE_DIR / v)

    @field_validator("alert_stages")
    @classmethod
    def known_stages(cls, v: list[str]) -> list[str]:
        unknown = [s for s in v if s not in STAGES[1:]]
        if unknown:
            raise ValueError(f"Unknown stages in ALERT_STAGES: {unknown}")
        return v


@lru_cache
def get_settings() -> Settings:
    return Settings()
