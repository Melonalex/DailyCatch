import argparse
import hashlib
import logging
import sys
import time
from datetime import date, datetime, timedelta
from pathlib import Path

import pymysql

PACKAGE_ROOT = Path(__file__).resolve().parents[1]
if str(PACKAGE_ROOT) not in sys.path:
    sys.path.insert(0, str(PACKAGE_ROOT))

from common.config import (  # noqa: E402
    DEEPSEEK_PAUSE_SECONDS,
    HTTP_RETRIES,
    HTTP_TIMEOUT_SECONDS,
    SHANGHAI,
    load_settings,
)
from common.db import connect, ensure_schema  # noqa: E402
from fetcher.http_client import request_with_retries  # noqa: E402
from fetcher.lesson import TYPE_SPECS, compose_lesson, save_lesson  # noqa: E402
from fetcher.sources.hackernews import fetch_comments  # noqa: E402
from fetcher.text import plain_text  # noqa: E402

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)
logger = logging.getLogger("backfill")

EPOCH = date(2026, 10, 1)
TYPE_ORDER = ("ielts", "daily", "tech", "news")
SEARCH_URL = "https://hn.algolia.com/api/v1/search"
INSERT_SQL = """
INSERT INTO articles (
  digest_date, source_type, source_name, title, url, url_hash,
  author, points, comment_count, published_at,
  summary, vocabulary, comments_digest
) VALUES (
  %s, %s, %s, %s, %s, %s,
  %s, %s, %s, %s,
  NULL, NULL, NULL
)
"""


def main(argv: list[str] | None = None) -> int:
    args = _parse_args(argv)
    start = _parse_date(args.start)
    end = _parse_date(args.end)
    if start is None or end is None or start > end:
        logger.error("Invalid date range")
        return 1
    try:
        settings = load_settings()
    except (RuntimeError, ValueError) as exc:
        logger.error("%s", exc)
        return 1
    if not settings.deepseek_api_key:
        logger.error("DEEPSEEK_API_KEY is empty")
        return 1

    connection = connect(settings)
    saved = 0
    skipped = 0
    failed: list[str] = []
    try:
        ensure_schema(connection)
        day = start
        while day <= end:
            if _lesson_exists(connection, day) and not args.replace:
                logger.info("Skip %s; lesson already stored", day.isoformat())
                skipped += 1
            else:
                ok = _fill_day(connection, day, settings.deepseek_api_key, replace=args.replace)
                if ok:
                    saved += 1
                    time.sleep(DEEPSEEK_PAUSE_SECONDS)
                else:
                    failed.append(day.isoformat())
            day += timedelta(days=1)
    finally:
        connection.close()

    print(
        f"backfill saved={saved} skipped={skipped} failed={len(failed)}"
        + (f" failed_dates={','.join(failed)}" if failed else "")
    )
    return 0 if not failed else 1


def assignment_for_day(day: date) -> dict:
    index = (day - EPOCH).days
    if index < 0:
        raise ValueError(f"{day.isoformat()} is before {EPOCH.isoformat()}")
    article_type = TYPE_ORDER[index % len(TYPE_ORDER)]
    spec = TYPE_SPECS[article_type]
    topics = spec["topics"]
    topic = topics[(index // len(TYPE_ORDER)) % len(topics)]
    return {
        "article_type": article_type,
        "topic": topic,
        "difficulty": spec["difficulty"],
        "words": spec["words"],
        "instruction": spec["instruction"],
    }


def _fill_day(connection, day: date, api_key: str, replace: bool = False) -> bool:
    try:
        items = _stories_for_day(day)
    except Exception:
        logger.exception("Hacker News lookup failed for %s", day.isoformat())
        return False
    if not items:
        logger.error("No Hacker News stories for %s", day.isoformat())
        return False
    if replace:
        with connection.cursor() as cursor:
            cursor.execute("DELETE FROM articles WHERE digest_date = %s", (day,))
        connection.commit()
    for item in items:
        try:
            _store_story(connection, day, item)
        except pymysql.err.IntegrityError:
            connection.rollback()
        except Exception:
            logger.exception("Failed to store a source story for %s", day.isoformat())
            connection.rollback()
    assignment = assignment_for_day(day)
    lesson = compose_lesson(connection, day, items, api_key, assignment)
    if lesson is None:
        return False
    try:
        count = save_lesson(connection, day, lesson)
    except Exception:
        logger.exception("Failed to store lesson for %s", day.isoformat())
        return False
    logger.info(
        "Stored %s %s/%s hot_topics=%s",
        day.isoformat(),
        assignment["article_type"],
        assignment["topic"],
        count,
    )
    return True


def _stories_for_day(day: date) -> list[dict]:
    start = datetime(day.year, day.month, day.day, tzinfo=SHANGHAI)
    end = start + timedelta(days=1)
    response = request_with_retries(
        "GET",
        SEARCH_URL,
        params={
            "tags": "story",
            "hitsPerPage": 40,
            "numericFilters": f"created_at_i>={int(start.timestamp())},created_at_i<{int(end.timestamp())}",
        },
        timeout=HTTP_TIMEOUT_SECONDS,
        retries=HTTP_RETRIES,
    )
    stories = []
    for hit in response.json().get("hits") or []:
        url = (hit.get("url") or "").strip()
        title = plain_text(hit.get("title"))
        if not url or not title:
            continue
        created = hit.get("created_at")
        published = None
        if isinstance(created, str):
            try:
                published = datetime.fromisoformat(created.replace("Z", "+00:00")).replace(tzinfo=None)
            except ValueError:
                published = None
        points = hit.get("points") or 0
        try:
            points = int(points)
        except (TypeError, ValueError):
            points = 0
        stories.append(
            {
                "source_type": "hackernews",
                "source_name": "Hacker News",
                "title": title[:512],
                "url": url[:1024],
                "author": hit.get("author"),
                "points": points,
                "comment_count": hit.get("num_comments"),
                "published_at": published,
                "story_id": hit.get("objectID"),
                "excerpt": "",
                "comments": [],
            }
        )
    stories.sort(key=lambda item: item["points"], reverse=True)
    chosen = stories[:8]
    for story in chosen[:2]:
        story_id = story.get("story_id")
        if not story_id:
            continue
        try:
            story["comments"] = fetch_comments(str(story_id))
        except Exception:
            logger.exception("Comments failed for story %s", story_id)
            story["comments"] = []
    return chosen


def _store_story(connection, day: date, item: dict) -> None:
    url = item["url"][:1024]
    with connection.cursor() as cursor:
        cursor.execute(
            INSERT_SQL,
            (
                day,
                "hackernews",
                "Hacker News",
                item["title"][:512],
                url,
                hashlib.sha256(url.encode("utf-8")).hexdigest(),
                ((item.get("author") or "")[:128] or None),
                item.get("points"),
                item.get("comment_count"),
                item.get("published_at"),
            ),
        )
    connection.commit()


def _lesson_exists(connection, day: date) -> bool:
    with connection.cursor() as cursor:
        cursor.execute("SELECT 1 FROM lessons WHERE digest_date = %s", (day,))
        return cursor.fetchone() is not None


def _parse_args(argv: list[str] | None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Backfill one short article per day")
    parser.add_argument("--from", dest="start", default="2026-10-01")
    parser.add_argument("--to", dest="end", default="2026-11-09")
    parser.add_argument("--replace", action="store_true", help="Rewrite days that already have a lesson")
    return parser.parse_args(argv)


def _parse_date(raw: str) -> date | None:
    try:
        return datetime.strptime(raw, "%Y-%m-%d").date()
    except ValueError:
        logger.error("Invalid date %s", raw)
        return None


if __name__ == "__main__":
    sys.exit(main())
