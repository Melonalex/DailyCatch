import logging
from datetime import datetime

from common.config import (
    COMMENT_MAX_CHARS,
    HN_COMMENT_FETCH,
    HN_COMMENT_KEEP,
    HTTP_RETRIES,
    HTTP_TIMEOUT_SECONDS,
)
from fetcher.http_client import request_with_retries
from fetcher.text import plain_text

logger = logging.getLogger(__name__)

SEARCH_URL = "https://hn.algolia.com/api/v1/search"


def fetch_front_page(limit: int) -> list[dict]:
    response = request_with_retries(
        "GET",
        SEARCH_URL,
        params={"tags": "front_page", "hitsPerPage": max(limit * 3, 30)},
        timeout=HTTP_TIMEOUT_SECONDS,
        retries=HTTP_RETRIES,
    )
    stories: list[dict] = []
    for hit in response.json().get("hits") or []:
        url = (hit.get("url") or "").strip()
        title = plain_text(hit.get("title"))
        if not url or not title:
            continue
        stories.append(
            {
                "source_type": "hackernews",
                "source_name": "Hacker News",
                "title": title[:512],
                "url": url[:1024],
                "author": hit.get("author"),
                "points": hit.get("points"),
                "comment_count": hit.get("num_comments"),
                "published_at": _published_at(hit.get("created_at")),
                "story_id": hit.get("objectID"),
                "excerpt": "",
                "comments": [],
            }
        )
        if len(stories) >= limit:
            break

    for story in stories:
        story_id = story.get("story_id")
        if not story_id:
            continue
        try:
            story["comments"] = fetch_comments(str(story_id))
        except Exception:
            logger.exception("Failed to fetch comments for story %s", story_id)
            story["comments"] = []
    logger.info("Fetched %s Hacker News stories", len(stories))
    return stories


def fetch_comments(story_id: str) -> list[dict]:
    response = request_with_retries(
        "GET",
        SEARCH_URL,
        params={
            "tags": f"comment,story_{story_id}",
            "hitsPerPage": HN_COMMENT_FETCH,
        },
        timeout=HTTP_TIMEOUT_SECONDS,
        retries=HTTP_RETRIES,
    )
    comments: list[dict] = []
    for hit in response.json().get("hits") or []:
        text = plain_text(hit.get("comment_text"))
        if not text:
            continue
        points = hit.get("points") or 0
        try:
            points = int(points)
        except (TypeError, ValueError):
            points = 0
        comments.append(
            {
                "author": (hit.get("author") or "").strip(),
                "text": text[:COMMENT_MAX_CHARS],
                "points": points,
            }
        )
    comments.sort(key=lambda item: item["points"], reverse=True)
    return comments[:HN_COMMENT_KEEP]


def _published_at(value: object) -> datetime | None:
    if not isinstance(value, str) or not value.strip():
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        logger.warning("Could not parse Hacker News time %s", value)
        return None
    return parsed.replace(tzinfo=None)
