import json
import logging
from datetime import date, datetime

from common.config import DEEPSEEK_MODEL, DEEPSEEK_URL, HTTP_RETRIES
from fetcher.http_client import request_with_retries

logger = logging.getLogger(__name__)

TYPE_SPECS = {
    "ielts": {
        "difficulty": "IELTS 6.5-7.5",
        "words": "560-820",
        "topics": ("education", "technology", "society", "environment", "workplace"),
        "instruction": (
            "Write an original short story at IELTS 6.5-7.5. "
            "One person, one place, a problem, a turn, and an ending. "
            "The argument belongs inside the story, not in a lecture after it. "
            "Formal, clear, and idiomatic. Do not retell the supplied news."
        ),
    },
    "daily": {
        "difficulty": "Everyday English",
        "words": "480-700",
        "topics": ("home", "commute", "food", "weekend", "shopping", "neighbors"),
        "instruction": (
            "Write an original everyday short story. "
            "A full scene, several lines of spoken dialogue, a small problem, and a quiet ending. "
            "Use common spoken vocabulary. Do not retell the supplied news."
        ),
    },
    "tech": {
        "difficulty": "Upper-intermediate technology",
        "words": "560-820",
        "topics": ("artificial intelligence", "programming", "the internet", "developer work"),
        "instruction": (
            "Write an original short story for a reader who studies computer science. "
            "Follow one person through a working day. The technical idea is what they run into, "
            "not a textbook section after the scene. Do not retell the supplied news."
        ),
    },
    "news": {
        "difficulty": "News English",
        "words": "420-620",
        "topics": ("current events",),
        "instruction": (
            "Write a medium-short news account using only the supplied items. "
            "You may follow the events in time and quote the supplied comments. "
            "Do not invent a character, a scene, a motive, a number, or any fact that is not in the items."
        ),
    },
}

SYSTEM_PROMPT = (
    "You write one English study article and a short list of hot topics. "
    "Return one JSON object with keys article_type, difficulty, topic, title, paragraphs, "
    "translation, vocabulary, hot_topics. "
    "Follow the requested article_type, topic, difficulty, and word range. "
    "Count words in the English paragraphs only. A piece under the minimum is incomplete; do not stop early. "
    "title is at most 8 words. "
    "paragraphs is 6 to 9 English paragraphs. "
    "translation is the same number of paragraphs, a faithful Chinese translation, with no extra commentary. "
    "vocabulary has 5 to 8 entries from the article. Each entry has word, pos, meaning, usage, and contrast. "
    "pos is a short grammar label such as n. or verb. "
    "meaning is a short Chinese gloss. usage is a natural English collocation. "
    "contrast is an empty string, or one short note when the word is easily confused, in English plus a Chinese gloss. "
    "hot_topics has 1 entry by default and at most 3, ranked from the most discussed to the least. "
    "Add a second or third topic only for another major international, technology, chip, or corporate event in the items. "
    "Each hot topic has title, overview, quotes, and background. "
    "title and overview are English. The overview must name the date, the actor, and the source. "
    "quotes has 2 to 4 items taken only from supplied comments or excerpts. "
    "Each quote has text, speaker, source_type, and stance. "
    "source_type is one of: CEO statement, Public figure, Analyst, Public reaction. "
    "stance is one of: Support, Doubt, Aside. "
    "text must stay close to the supplied wording and must not invent a speaker. "
    "background is one or two short Chinese sentences of context, not a full translation. "
    "Never invent an event, a person, a number, or a quotation."
)


def assignment_for(connection, digest_date: date) -> dict:
    with connection.cursor() as cursor:
        cursor.execute(
            "SELECT article_type, topic FROM lessons WHERE digest_date = %s",
            (digest_date,),
        )
        current = cursor.fetchone()
        if current and current[0] in TYPE_SPECS:
            article_type = current[0]
            topic = current[1] or TYPE_SPECS[article_type]["topics"][0]
        else:
            cursor.execute(
                """
                SELECT article_type, topic
                FROM lessons
                WHERE digest_date <> %s
                ORDER BY digest_date DESC
                LIMIT 1
                """,
                (digest_date,),
            )
            previous = cursor.fetchone()
            article_type, topic = _next_pair(cursor, previous)
    spec = TYPE_SPECS[article_type]
    if topic not in spec["topics"]:
        topic = spec["topics"][0]
    return {
        "article_type": article_type,
        "topic": topic,
        "difficulty": spec["difficulty"],
        "words": spec["words"],
        "instruction": spec["instruction"],
    }


def compose_lesson(
    connection,
    digest_date: date,
    items: list[dict],
    api_key: str,
    assignment: dict | None = None,
) -> dict | None:
    if assignment is None:
        assignment = assignment_for(connection, digest_date)
    logger.info(
        "Lesson assignment %s / %s / %s",
        assignment["article_type"],
        assignment["topic"],
        assignment["difficulty"],
    )
    payload = {
        "assignment": assignment,
        "items": [_material(item) for item in items],
    }
    body = {
        "model": DEEPSEEK_MODEL,
        "temperature": 0.3,
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": json.dumps(payload, ensure_ascii=True, default=_json_default)},
        ],
    }
    try:
        response = request_with_retries(
            "POST",
            DEEPSEEK_URL,
            timeout=180,
            retries=HTTP_RETRIES,
            headers={"Authorization": f"Bearer {api_key}"},
            json=body,
        )
        content = response.json()["choices"][0]["message"]["content"]
        lesson = parse_lesson(content, assignment)
        if lesson is None:
            return None
        count = _word_count(lesson["paragraphs"])
        minimum = _minimum_words(assignment.get("words", ""))
        if minimum and count < minimum:
            logger.warning("Lesson is short (%s words, minimum %s); retrying once", count, minimum)
            retry = _request_lesson(body, api_key, assignment)
            if retry and _word_count(retry["paragraphs"]) > count:
                return retry
        return lesson
    except Exception:
        logger.exception("Lesson request failed")
        return None


def _request_lesson(body: dict, api_key: str, assignment: dict) -> dict | None:
    try:
        response = request_with_retries(
            "POST",
            DEEPSEEK_URL,
            timeout=180,
            retries=HTTP_RETRIES,
            headers={"Authorization": f"Bearer {api_key}"},
            json=body,
        )
        content = response.json()["choices"][0]["message"]["content"]
        return parse_lesson(content, assignment)
    except Exception:
        logger.exception("Lesson retry failed")
        return None


def _word_count(paragraphs: list[str]) -> int:
    return len(" ".join(paragraphs).split())


def _minimum_words(spec: str) -> int:
    low = spec.split("-", 1)[0].strip()
    if not low.isdigit():
        return 0
    return int(int(low) * 0.9)


def parse_lesson(content: str, assignment: dict) -> dict | None:
    try:
        data = json.loads(content)
    except json.JSONDecodeError:
        logger.error("Lesson response was not valid JSON")
        return None
    if not isinstance(data, dict):
        logger.error("Lesson JSON root is not an object")
        return None
    title = _clean_text(data.get("title"))
    paragraphs = _string_list(data.get("paragraphs"))
    if not title or not paragraphs:
        logger.error("Lesson title or paragraphs are missing")
        return None
    translation = _string_list(data.get("translation"))
    if len(translation) != len(paragraphs):
        logger.warning("Lesson translation does not match the paragraphs")
        translation = []
    return {
        "article_type": assignment["article_type"],
        "difficulty": assignment["difficulty"],
        "topic": assignment["topic"],
        "title": title[:256],
        "paragraphs": paragraphs[:9],
        "translation": translation[:9],
        "vocabulary": _vocabulary(data.get("vocabulary")),
        "hot_topics": _hot_topics(data.get("hot_topics")),
    }


def save_lesson(connection, digest_date: date, lesson: dict) -> int:
    try:
        with connection.cursor() as cursor:
            cursor.execute("DELETE FROM hot_topics WHERE digest_date = %s", (digest_date,))
            cursor.execute("DELETE FROM lessons WHERE digest_date = %s", (digest_date,))
            cursor.execute(
                """
                INSERT INTO lessons (
                  digest_date, article_type, difficulty, topic, title, body, translation, vocabulary
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    digest_date,
                    lesson["article_type"],
                    lesson["difficulty"],
                    lesson["topic"],
                    lesson["title"],
                    json.dumps(lesson["paragraphs"], ensure_ascii=False),
                    json.dumps(lesson["translation"], ensure_ascii=False) if lesson["translation"] else None,
                    json.dumps(lesson["vocabulary"], ensure_ascii=False) if lesson["vocabulary"] else None,
                ),
            )
            for index, topic in enumerate(lesson.get("hot_topics") or []):
                cursor.execute(
                    """
                    INSERT INTO hot_topics (
                      digest_date, sort_order, title, overview, quotes, background
                    ) VALUES (%s, %s, %s, %s, %s, %s)
                    """,
                    (
                        digest_date,
                        index,
                        topic["title"][:256],
                        topic["overview"],
                        json.dumps(topic["quotes"], ensure_ascii=False) if topic["quotes"] else None,
                        topic.get("background"),
                    ),
                )
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    return len(lesson.get("hot_topics") or [])


def _next_pair(cursor, previous) -> tuple[str, str]:
    types = tuple(TYPE_SPECS)
    if not previous or previous[0] not in TYPE_SPECS:
        return "ielts", TYPE_SPECS["ielts"]["topics"][0]
    next_type = types[(types.index(previous[0]) + 1) % len(types)]
    topics = TYPE_SPECS[next_type]["topics"]
    cursor.execute(
        """
        SELECT topic FROM lessons
        WHERE article_type = %s
        ORDER BY digest_date DESC
        LIMIT 1
        """,
        (next_type,),
    )
    row = cursor.fetchone()
    if row and row[0] in topics:
        topic = topics[(topics.index(row[0]) + 1) % len(topics)]
    else:
        topic = topics[0]
    return next_type, topic


def _material(item: dict) -> dict:
    published = item.get("published_at")
    if isinstance(published, datetime):
        published = published.strftime("%Y-%m-%d %H:%M")
    comments = []
    for comment in (item.get("comments") or [])[:5]:
        text = _clean_text(comment.get("text"))
        if text:
            comments.append({"author": comment.get("author") or "", "text": text[:500]})
    return {
        "title": item.get("title") or "",
        "source": item.get("source_name") or "",
        "url": item.get("url") or "",
        "published_at": published,
        "points": item.get("points"),
        "excerpt": (_clean_text(item.get("excerpt")) or "")[:600],
        "comments": comments,
    }


def _vocabulary(value) -> list[dict]:
    if not isinstance(value, list):
        logger.error("Lesson vocabulary is missing")
        return []
    cleaned = []
    for entry in value:
        if not isinstance(entry, dict):
            continue
        word = _clean_text(entry.get("word"))
        meaning = _clean_text(entry.get("meaning"))
        if not word or not meaning:
            continue
        cleaned.append(
            {
                "word": word,
                "pos": _clean_text(entry.get("pos")) or "",
                "meaning": meaning,
                "usage": _clean_text(entry.get("usage")) or "",
                "contrast": _clean_text(entry.get("contrast")) or "",
            }
        )
    if not 5 <= len(cleaned) <= 8:
        logger.warning("Lesson vocabulary has %s entries", len(cleaned))
    return cleaned[:8]


def _hot_topics(value) -> list[dict]:
    if not isinstance(value, list):
        logger.error("Hot topics are missing")
        return []
    topics = []
    for entry in value:
        if not isinstance(entry, dict):
            continue
        title = _clean_text(entry.get("title"))
        overview = _clean_text(entry.get("overview"))
        if not title or not overview:
            continue
        topics.append(
            {
                "title": title,
                "overview": overview,
                "quotes": _quotes(entry.get("quotes")),
                "background": _clean_text(entry.get("background")) or "",
            }
        )
        if len(topics) == 3:
            break
    if not topics:
        logger.error("No usable hot topic was returned")
    return topics


def _quotes(value) -> list[dict]:
    if not isinstance(value, list):
        return []
    quotes = []
    for entry in value:
        if not isinstance(entry, dict):
            continue
        text = _clean_text(entry.get("text"))
        if not text:
            continue
        text = text.lstrip(">").strip()
        if not text:
            continue
        quotes.append(
            {
                "text": text,
                "speaker": _clean_text(entry.get("speaker")) or "unknown",
                "source_type": _choice(
                    entry.get("source_type"),
                    {"CEO statement", "Public figure", "Analyst", "Public reaction"},
                    "Public reaction",
                ),
                "stance": _choice(
                    entry.get("stance"),
                    {"Support", "Doubt", "Aside"},
                    "Aside",
                ),
            }
        )
        if len(quotes) == 4:
            break
    return quotes


def _choice(value, allowed: set[str], default: str) -> str:
    text = _clean_text(value)
    return text if text in allowed else default


def _string_list(value) -> list[str]:
    if isinstance(value, str):
        value = [value]
    if not isinstance(value, list):
        return []
    return [text for item in value if (text := _clean_text(item))]


def _clean_text(value) -> str | None:
    if not isinstance(value, str):
        return None
    text = " ".join(value.split())
    return text or None


def _json_default(value):
    if isinstance(value, datetime):
        return value.strftime("%Y-%m-%d %H:%M")
    raise TypeError(f"Cannot encode {type(value)}")
