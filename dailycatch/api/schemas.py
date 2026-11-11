"""Response models for the read-only HTTP API.

These classes are the wire contract. JSON columns stay ``Any`` so stored
objects are returned as they are, including keys the page does not read.
"""

from typing import Any

from pydantic import BaseModel


class Health(BaseModel):
    """Liveness payload. ``status`` is ``ok`` when the process is up."""

    status: str


class IssueSummary(BaseModel):
    """One issue in the sidebar, newest first.

    ``title``, ``article_type``, ``difficulty``, and ``topic`` are null when
    that date has source rows but no lesson.
    """

    date: str
    title: str | None = None
    article_type: str | None = None
    difficulty: str | None = None
    topic: str | None = None


class Lesson(BaseModel):
    """The study article stored for one date.

    ``paragraphs``, ``translation``, and ``vocabulary`` are decoded JSON.
    Missing or invalid JSON becomes an empty list.
    """

    article_type: str
    difficulty: str
    topic: str
    title: str
    paragraphs: Any
    translation: Any
    vocabulary: Any


class HotTopic(BaseModel):
    """One hot topic under a date.

    ``quotes`` is the decoded JSON array. ``background`` may be null.
    """

    id: int
    title: str
    overview: str
    quotes: Any
    background: str | None = None


class DigestItem(BaseModel):
    """One collected source article.

    ``published_at`` is ``YYYY-MM-DD HH:MM:SS``, or null. ``vocabulary`` and
    ``comments_digest`` are decoded JSON, or null when nothing was stored.
    """

    id: int
    source_type: str
    source_name: str
    title: str
    url: str
    author: str | None = None
    points: int | None = None
    comment_count: int | None = None
    published_at: str | None = None
    summary: str | None = None
    vocabulary: Any = None
    comments_digest: Any = None


class Digest(BaseModel):
    """One date's lesson, hot topics, and source articles.

    The route returns this only when at least one of the three is present.
    """

    date: str
    lesson: Lesson | None
    hot_topics: list[HotTopic]
    items: list[DigestItem]
