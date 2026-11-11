import sys
from contextlib import asynccontextmanager
from datetime import datetime
from pathlib import Path

from fastapi import FastAPI, HTTPException

PACKAGE_ROOT = Path(__file__).resolve().parents[1]
if str(PACKAGE_ROOT) not in sys.path:
    sys.path.insert(0, str(PACKAGE_ROOT))

from api.repository import get_digest, get_hot_topics, get_lesson, list_dates  # noqa: E402
from api.schemas import Digest, Health, IssueSummary  # noqa: E402
from common.config import load_settings  # noqa: E402
from common.db import ensure_schema, open_connection  # noqa: E402
from fetcher.schedule import start_daily_schedule  # noqa: E402


@asynccontextmanager
async def lifespan(_app: FastAPI):
    with open_connection(load_settings()) as connection:
        ensure_schema(connection)
    start_daily_schedule()
    yield


app = FastAPI(title="DailyCatch", lifespan=lifespan)


@app.middleware("http")
async def disable_api_cache(request, call_next):
    response = await call_next(request)
    if request.url.path.startswith("/api"):
        response.headers["Cache-Control"] = "no-store"
    return response


@app.get("/api/health", response_model=Health)
def health() -> Health:
    return Health(status="ok")


@app.get("/api/dates", response_model=list[IssueSummary])
def dates() -> list[IssueSummary]:
    with open_connection(load_settings(), dictionary=True) as connection:
        return list_dates(connection)


@app.get("/api/digests/{digest_date}", response_model=Digest)
def digest(digest_date: str) -> Digest:
    try:
        parsed = datetime.strptime(digest_date, "%Y-%m-%d").date()
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid date") from exc
    with open_connection(load_settings(), dictionary=True) as connection:
        items = get_digest(connection, parsed)
        lesson = get_lesson(connection, parsed)
        hot_topics = get_hot_topics(connection, parsed)
    if not items and lesson is None and not hot_topics:
        raise HTTPException(status_code=404, detail="No digest for this date")
    return Digest(
        date=parsed.isoformat(),
        lesson=lesson,
        hot_topics=hot_topics,
        items=items,
    )
