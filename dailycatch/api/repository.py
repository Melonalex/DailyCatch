import json
from datetime import date, datetime


def list_dates(connection) -> list[dict]:
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
    return [
        {
            "date": _date_text(row["digest_date"]),
            "title": row["title"],
            "article_type": row["article_type"],
            "difficulty": row["difficulty"],
            "topic": row["topic"],
        }
        for row in rows
    ]


def get_lesson(connection, digest_date: date) -> dict | None:
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
    return {
        "article_type": row["article_type"],
        "difficulty": row["difficulty"],
        "topic": row["topic"],
        "title": row["title"],
        "paragraphs": _decode_json(row["body"]) or [],
        "translation": _decode_json(row["translation"]) or [],
        "vocabulary": _decode_json(row["vocabulary"]) or [],
    }


def get_hot_topics(connection, digest_date: date) -> list[dict]:
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
    return [
        {
            "id": row["id"],
            "title": row["title"],
            "overview": row["overview"],
            "quotes": _decode_json(row["quotes"]) or [],
            "background": row["background"],
        }
        for row in rows
    ]


def get_digest(connection, digest_date: date) -> list[dict]:
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


def _item(row: dict) -> dict:
    return {
        "id": row["id"],
        "source_type": row["source_type"],
        "source_name": row["source_name"],
        "title": row["title"],
        "url": row["url"],
        "author": row["author"],
        "points": row["points"],
        "comment_count": row["comment_count"],
        "published_at": _timestamp_text(row["published_at"]),
        "summary": row["summary"],
        "vocabulary": _decode_json(row["vocabulary"]),
        "comments_digest": _decode_json(row["comments_digest"]),
    }


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
