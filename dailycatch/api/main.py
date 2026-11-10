import sys
from contextlib import asynccontextmanager
from datetime import datetime
from pathlib import Path

from fastapi import FastAPI, HTTPException

PACKAGE_ROOT = Path(__file__).resolve().parents[1]
if str(PACKAGE_ROOT) not in sys.path:
    sys.path.insert(0, str(PACKAGE_ROOT))

from api.repository import get_digest, get_hot_topics, get_lesson, list_dates  # noqa: E402
from common.config import load_settings  # noqa: E402
from common.db import connect, ensure_schema  # noqa: E402


@asynccontextmanager
async def lifespan(_app: FastAPI):
    connection = connect(load_settings())
    try:
        ensure_schema(connection)
    finally:
        connection.close()
    yield


app = FastAPI(title="DailyCatch", lifespan=lifespan)


@app.middleware("http")
async def disable_api_cache(request, call_next):
    response = await call_next(request)
    if request.url.path.startswith("/api"):
        response.headers["Cache-Control"] = "no-store"
    return response


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.get("/api/dates")
def dates():
    connection = connect(load_settings(), dictionary=True)
    try:
        return list_dates(connection)
    finally:
        connection.close()


@app.get("/api/digests/{digest_date}")
def digest(digest_date: str):
    try:
        parsed = datetime.strptime(digest_date, "%Y-%m-%d").date()
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid date") from exc
    connection = connect(load_settings(), dictionary=True)
    try:
        items = get_digest(connection, parsed)
        lesson = get_lesson(connection, parsed)
        hot_topics = get_hot_topics(connection, parsed)
    finally:
        connection.close()
    if not items and lesson is None and not hot_topics:
        raise HTTPException(status_code=404, detail="No digest for this date")
    return {
        "date": parsed.isoformat(),
        "lesson": lesson,
        "hot_topics": hot_topics,
        "items": items,
    }
