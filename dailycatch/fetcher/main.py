import argparse
import hashlib
import logging
import sys
from datetime import datetime
from pathlib import Path

import pymysql

PACKAGE_ROOT = Path(__file__).resolve().parents[1]
if str(PACKAGE_ROOT) not in sys.path:
    sys.path.insert(0, str(PACKAGE_ROOT))

from common.config import HN_COUNT, load_settings, today_shanghai  # noqa: E402
from common.db import connect, ensure_schema  # noqa: E402
from fetcher.lesson import compose_lesson, save_lesson  # noqa: E402
from fetcher.sources.hackernews import fetch_front_page  # noqa: E402
from fetcher.sources.rss import fetch_feeds  # noqa: E402

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)
logger = logging.getLogger("fetcher")

INSERT_SQL = """
INSERT INTO articles (
  digest_date, source_type, source_name, title, url, url_hash,
  author, points, comment_count, published_at,
  summary, vocabulary, comments_digest
) VALUES (
  %s, %s, %s, %s, %s, %s,
  %s, %s, %s, %s,
  %s, %s, %s
)
"""


def main(argv: list[str] | None = None) -> int:
    args = _parse_args(argv)
    digest_date = _digest_date(args.digest_date)
    if digest_date is None:
        return 1

    try:
        settings = load_settings()
    except (RuntimeError, ValueError) as exc:
        logger.error("%s", exc)
        return 1

    use_ai = not args.no_ai and bool(settings.deepseek_api_key)
    if not args.no_ai and not settings.deepseek_api_key:
        logger.warning("DEEPSEEK_API_KEY is empty; storing items without AI fields")

    try:
        connection = connect(settings)
    except pymysql.MySQLError:
        logger.exception("Could not connect to MySQL")
        return 1

    stored = {"hackernews": 0, "rss": 0}
    lesson_status = "skipped"
    hot_topic_count = 0
    try:
        ensure_schema(connection)
        with connection.cursor() as cursor:
            cursor.execute(
                "DELETE FROM articles WHERE digest_date = %s",
                (digest_date,),
            )
        connection.commit()
        logger.info("Cleared digest %s", digest_date.isoformat())

        items = _collect_items(settings.feeds)
        for item in items:
            try:
                saved = _store_item(connection, digest_date, item)
            except pymysql.err.IntegrityError:
                logger.warning("Duplicate url skipped: %s", item.get("url"))
                continue
            except Exception:
                logger.exception("Failed to store %s", item.get("url"))
                continue
            if saved:
                stored[item["source_type"]] = stored.get(item["source_type"], 0) + 1

        if use_ai and stored["hackernews"] + stored["rss"] > 0:
            lesson = compose_lesson(connection, digest_date, items, settings.deepseek_api_key)
            if lesson is None:
                lesson_status = "failed"
            else:
                try:
                    hot_topic_count = save_lesson(connection, digest_date, lesson)
                    lesson_status = "ok"
                except Exception:
                    logger.exception("Failed to store the lesson")
                    lesson_status = "failed"
    except Exception:
        logger.exception("Fetcher failed")
        return 1
    finally:
        connection.close()

    total = sum(stored.values())
    print(
        "stored "
        + " ".join(f"{name}={count}" for name, count in stored.items())
        + f" lesson={lesson_status} hot_topics={hot_topic_count}"
    )
    return 0 if total > 0 else 1


def _parse_args(argv: list[str] | None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Collect the daily English digest")
    parser.add_argument(
        "--date",
        dest="digest_date",
        help="Digest date YYYY-MM-DD (default: today in Asia/Shanghai)",
    )
    parser.add_argument(
        "--no-ai",
        action="store_true",
        help="Skip DeepSeek enrichment",
    )
    return parser.parse_args(argv)


def _digest_date(raw: str | None):
    if not raw:
        return today_shanghai()
    try:
        return datetime.strptime(raw, "%Y-%m-%d").date()
    except ValueError:
        logger.error("Invalid --date value %s", raw)
        return None


def _collect_items(feeds) -> list[dict]:
    items: list[dict] = []
    try:
        items.extend(fetch_front_page(HN_COUNT))
    except Exception:
        logger.exception("Hacker News fetch failed")
    try:
        items.extend(fetch_feeds(feeds))
    except Exception:
        logger.exception("RSS fetch failed")
    return items


def _store_item(connection, digest_date, item: dict) -> bool:
    title = _text(item.get("title"), 512)
    url = _text(item.get("url"), 1024)
    source_name = _text(item.get("source_name"), 64)
    if not title or not url or not source_name:
        logger.warning("Skipping item with missing title, url, or source")
        return False
    try:
        with connection.cursor() as cursor:
            cursor.execute(
                INSERT_SQL,
                (
                    digest_date,
                    item["source_type"],
                    source_name,
                    title,
                    url,
                    _url_hash(url),
                    _text(item.get("author"), 128),
                    _optional_int(item.get("points")),
                    _optional_int(item.get("comment_count")),
                    item.get("published_at"),
                    None,
                    None,
                    None,
                ),
            )
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    return True


def _url_hash(url: str) -> str:
    return hashlib.sha256(url.encode("utf-8")).hexdigest()


def _text(value: object, limit: int) -> str | None:
    if not isinstance(value, str):
        return None
    text = value.strip()
    if not text:
        return None
    return text[:limit]


def _optional_int(value: object) -> int | None:
    if value is None or value is False or value == "":
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


if __name__ == "__main__":
    sys.exit(main())
