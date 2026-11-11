import json
from datetime import date, datetime

from api.schemas import DigestItem, HotTopic, IssueSummary, Lesson


def list_dates(connection) -> list[IssueSummary]:
    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT issues.digest_date, lessons.title, lessons.article_type,
                   lessons.difficulty, lessons.topic
            FROM (
              SELECT digest_date FROM articles
              UNION
              SELECT digest_date FROM lessons
            ) AS issues
            LEFT JOIN lessons ON lessons.digest_date = issues.digest_date
            ORDER BY issues.digest_date DESC
            """
        )
        rows = cursor.fetchall()
    return [_issue(row) for row in rows]


def get_lesson(connection, digest_date: date) -> Lesson | None:
    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT article_type, difficulty, topic, title, body, translation, vocabulary
            FROM lessons
            WHERE digest_date = %s
            """,
            (digest_date,),
        )
        row = cursor.fetchone()
    if not row:
        return None
    return _lesson(row)


def get_hot_topics(connection, digest_date: date) -> list[HotTopic]:
    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT id, title, overview, quotes, background
            FROM hot_topics
            WHERE digest_date = %s
            ORDER BY sort_order, id
            """,
            (digest_date,),
        )
        rows = cursor.fetchall()
    return [_hot_topic(row) for row in rows]


def get_digest(connection, digest_date: date) -> list[DigestItem]:
    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT id, source_type, source_name, title, url, author, points,
                   comment_count, published_at, summary, vocabulary, comments_digest
            FROM articles
            WHERE digest_date = %s
            ORDER BY source_type, source_name, id
            """,
            (digest_date,),
        )
        rows = cursor.fetchall()
    return [_item(row) for row in rows]


def _issue(row: dict) -> IssueSummary:
    return IssueSummary(
        date=_date_text(row["digest_date"]),
        title=row["title"],
        article_type=row["article_type"],
        difficulty=row["difficulty"],
        topic=row["topic"],
    )


def _lesson(row: dict) -> Lesson:
    return Lesson(
        article_type=row["article_type"],
        difficulty=row["difficulty"],
        topic=row["topic"],
        title=row["title"],
        paragraphs=_decode_json(row["body"]) or [],
        translation=_decode_json(row["translation"]) or [],
        vocabulary=_decode_json(row["vocabulary"]) or [],
    )


def _hot_topic(row: dict) -> HotTopic:
    return HotTopic(
        id=row["id"],
        title=row["title"],
        overview=row["overview"],
        quotes=_decode_json(row["quotes"]) or [],
        background=row["background"],
    )


def _item(row: dict) -> DigestItem:
    return DigestItem(
        id=row["id"],
        source_type=row["source_type"],
        source_name=row["source_name"],
        title=row["title"],
        url=row["url"],
        author=row["author"],
        points=row["points"],
        comment_count=row["comment_count"],
        published_at=_timestamp_text(row["published_at"]),
        summary=row["summary"],
        vocabulary=_decode_json(row["vocabulary"]),
        comments_digest=_decode_json(row["comments_digest"]),
    )


def _decode_json(value):
    if value is None or value == "":
        return None
    if isinstance(value, (list, dict)):
        return value
    try:
        return json.loads(value)
    except (TypeError, json.JSONDecodeError):
        return None


def _date_text(value) -> str:
    if isinstance(value, datetime):
        return value.date().isoformat()
    if isinstance(value, date):
        return value.isoformat()
    return str(value)


def _timestamp_text(value) -> str | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.strftime("%Y-%m-%d %H:%M:%S")
    return str(value)
