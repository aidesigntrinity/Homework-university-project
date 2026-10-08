import os
from dataclasses import dataclass
from zoneinfo import ZoneInfo

from dotenv import load_dotenv


@dataclass(frozen=True)
class Config:
    telegram_token: str
    allowed_user_ids: frozenset[int]
    default_timezone: str
    poll_interval_minutes: int
    allowed_feed_hosts: tuple[str, ...]
    database_path: str


def _csv(value: str) -> list[str]:
    return [part.strip() for part in value.split(",") if part.strip()]


def load_config() -> Config:
    load_dotenv()
    token = os.environ.get("TELEGRAM_BOT_TOKEN", "").strip()
    if not token:
        raise SystemExit("TELEGRAM_BOT_TOKEN is not set (see .env.example)")

    default_tz = os.environ.get("DEFAULT_TIMEZONE", "UTC").strip()
    try:
        ZoneInfo(default_tz)
    except Exception:
        raise SystemExit(f"DEFAULT_TIMEZONE {default_tz!r} is not a valid IANA timezone")

    try:
        allowed_ids = frozenset(int(x) for x in _csv(os.environ.get("ALLOWED_USER_IDS", "")))
    except ValueError:
        raise SystemExit("ALLOWED_USER_IDS must be comma-separated integers")

    return Config(
        telegram_token=token,
        allowed_user_ids=allowed_ids,
        default_timezone=default_tz,
        poll_interval_minutes=max(1, int(os.environ.get("POLL_INTERVAL_MINUTES", "15"))),
        allowed_feed_hosts=tuple(
            h.lower().lstrip(".")
            for h in _csv(os.environ.get("ALLOWED_FEED_HOSTS", "managebac.com,managebac.cn"))
        ),
        database_path=os.environ.get("DATABASE_PATH", "data/bot.sqlite3"),
    )
