import os
from dataclasses import dataclass
from datetime import date, datetime
from pathlib import Path
from zoneinfo import ZoneInfo

from dotenv import load_dotenv

ENV_PATH = Path(__file__).resolve().parents[1] / ".env"
load_dotenv(ENV_PATH)

SHANGHAI = ZoneInfo("Asia/Shanghai")

HN_COUNT = 10
ITEMS_PER_FEED = 5
HN_COMMENT_KEEP = 5
HN_COMMENT_FETCH = 50
COMMENT_MAX_CHARS = 500
RSS_MAX_AGE_HOURS = 48
RSS_EXCERPT_CHARS = 1500
DEEPSEEK_PAUSE_SECONDS = 0.5
HTTP_TIMEOUT_SECONDS = 10
HTTP_RETRIES = 2
DEEPSEEK_TIMEOUT_SECONDS = 60
DEEPSEEK_URL = "https://api.deepseek.com/chat/completions"
DEEPSEEK_MODEL = "deepseek-chat"

DEFAULT_RSS_FEEDS = (
    "BBC World|http://feeds.bbci.co.uk/news/world/rss.xml,"
    "The Guardian Tech|https://www.theguardian.com/uk/technology/rss"
)


@dataclass(frozen=True)
class Feed:
    name: str
    url: str


@dataclass(frozen=True)
class Settings:
    deepseek_api_key: str
    db_host: str
    db_port: int
    db_user: str
    db_password: str
    db_name: str
    feeds: tuple[Feed, ...]


def parse_feeds(raw: str) -> tuple[Feed, ...]:
    feeds: list[Feed] = []
    for part in raw.split(","):
        part = part.strip()
        if not part:
            continue
        if "|" not in part:
            raise ValueError(f"Invalid RSS feed entry: {part}")
        name, url = part.split("|", 1)
        name, url = name.strip(), url.strip()
        if not name or not url:
            raise ValueError(f"Invalid RSS feed entry: {part}")
        feeds.append(Feed(name=name, url=url))
    if not feeds:
        raise ValueError("RSS_FEEDS is empty")
    return tuple(feeds)


def load_settings() -> Settings:
    missing = [
        name
        for name in ("DB_HOST", "DB_USER", "DB_PASSWORD", "DB_NAME")
        if name not in os.environ
    ]
    if missing:
        raise RuntimeError("Missing environment variables: " + ", ".join(missing))
    return Settings(
        deepseek_api_key=os.getenv("DEEPSEEK_API_KEY", "").strip(),
        db_host=os.environ["DB_HOST"].strip(),
        db_port=int(os.getenv("DB_PORT", "3306")),
        db_user=os.environ["DB_USER"].strip(),
        db_password=os.environ["DB_PASSWORD"],
        db_name=os.environ["DB_NAME"].strip(),
        feeds=parse_feeds(os.getenv("RSS_FEEDS", DEFAULT_RSS_FEEDS)),
    )


def today_shanghai() -> date:
    return datetime.now(SHANGHAI).date()
