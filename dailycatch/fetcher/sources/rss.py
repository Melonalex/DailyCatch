import logging
from datetime import datetime, timedelta, timezone

from common.config import (
    HTTP_RETRIES,
    HTTP_TIMEOUT_SECONDS,
    ITEMS_PER_FEED,
    RSS_EXCERPT_CHARS,
    RSS_MAX_AGE_HOURS,
    Feed,
)
from fetcher.http_client import request_with_retries
from fetcher.text import plain_text

logger = logging.getLogger(__name__)


def fetch_feeds(feeds: tuple[Feed, ...], per_feed: int = ITEMS_PER_FEED) -> list[dict]:
    items: list[dict] = []
    cutoff = datetime.now(timezone.utc) - timedelta(hours=RSS_MAX_AGE_HOURS)
    for feed in feeds:
        try:
            items.extend(_fetch_feed(feed, per_feed, cutoff))
        except Exception:
            logger.exception("Failed to fetch feed %s", feed.name)
    return items


def _fetch_feed(feed: Feed, per_feed: int, cutoff: datetime) -> list[dict]:
    import feedparser

    response = request_with_retries(
        "GET",
        feed.url,
        timeout=HTTP_TIMEOUT_SECONDS,
        retries=HTTP_RETRIES,
    )
    parsed = feedparser.parse(response.content)
    if getattr(parsed, "bozo", False) and not parsed.entries:
        logger.error("Feed parse failed for %s: %s", feed.name, parsed.bozo_exception)
        return []

    items: list[dict] = []
    for entry in parsed.entries:
        if len(items) >= per_feed:
            break
        link = (entry.get("link") or "").strip()
        title = plain_text(entry.get("title"))
        if not link or not title:
            continue
        published = _entry_datetime(entry)
        if published is None or published < cutoff:
            continue
        excerpt = plain_text(entry.get("summary") or entry.get("description"))
        author = entry.get("author") if isinstance(entry.get("author"), str) else None
        items.append(
            {
                "source_type": "rss",
                "source_name": feed.name[:64],
                "title": title[:512],
                "url": link[:1024],
                "author": author,
                "points": None,
                "comment_count": None,
                "published_at": published.astimezone(timezone.utc).replace(tzinfo=None),
                "excerpt": excerpt[:RSS_EXCERPT_CHARS],
                "comments": [],
            }
        )
    logger.info("Fetched %s items from %s", len(items), feed.name)
    return items


def _entry_datetime(entry) -> datetime | None:
    for key in ("published_parsed", "updated_parsed"):
        value = entry.get(key)
        if not value:
            continue
        try:
            return datetime(*value[:6], tzinfo=timezone.utc)
        except (TypeError, ValueError):
            continue
    return None
