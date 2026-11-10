import json
import logging

from common.config import (
    DEEPSEEK_MODEL,
    DEEPSEEK_TIMEOUT_SECONDS,
    DEEPSEEK_URL,
    HTTP_RETRIES,
)
from fetcher.http_client import request_with_retries

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = (
    "You help an intermediate English learner understand one news item. "
    "Return a JSON object with exactly these keys: summary, vocabulary, comments_digest. "
    "summary is 3 to 5 sentences of simple English, about CEFR B1, with no title and no bullet list. "
    "vocabulary is an array of exactly 5 objects. Each object has word and meaning. "
    "Choose words that appear in the title, excerpt, or comments. "
    "meaning is a short definition in plain English. "
    "comments_digest is an array. When comments are provided, return 3 to 5 objects "
    "with author and point. point is one short sentence stating that person's main idea. "
    "When the comments array is empty, return comments_digest as an empty array. "
    "Do not add any other keys."
)


def summarize(item: dict, api_key: str) -> dict | None:
    payload = {
        "title": item.get("title") or "",
        "source": item.get("source_name") or "",
        "url": item.get("url") or "",
        "excerpt": item.get("excerpt") or "",
        "comments": [
            {"author": comment.get("author") or "", "text": comment.get("text") or ""}
            for comment in (item.get("comments") or [])
        ],
    }
    body = {
        "model": DEEPSEEK_MODEL,
        "temperature": 0.3,
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": json.dumps(payload, ensure_ascii=True)},
        ],
    }
    try:
        response = request_with_retries(
            "POST",
            DEEPSEEK_URL,
            timeout=DEEPSEEK_TIMEOUT_SECONDS,
            retries=HTTP_RETRIES,
            headers={"Authorization": f"Bearer {api_key}"},
            json=body,
        )
        content = response.json()["choices"][0]["message"]["content"]
        return parse_ai_payload(content, has_comments=bool(payload["comments"]))
    except Exception:
        logger.exception("DeepSeek request failed for %s", item.get("url"))
        return None


def parse_ai_payload(content: str, *, has_comments: bool) -> dict | None:
    try:
        data = json.loads(content)
    except json.JSONDecodeError:
        logger.error("DeepSeek returned invalid JSON")
        return None
    if not isinstance(data, dict):
        logger.error("DeepSeek JSON root is not an object")
        return None

    summary = data.get("summary")
    if not isinstance(summary, str) or not summary.strip():
        logger.error("DeepSeek summary is missing")
        return None

    vocabulary = _vocabulary(data.get("vocabulary"))
    if vocabulary is None:
        return None

    comments_digest = None
    if has_comments:
        comments_digest = _comments_digest(data.get("comments_digest"))

    return {
        "summary": summary.strip(),
        "vocabulary": vocabulary,
        "comments_digest": comments_digest,
    }


def _vocabulary(value: object) -> list[dict] | None:
    if not isinstance(value, list):
        logger.error("DeepSeek vocabulary is missing")
        return None
    cleaned: list[dict] = []
    for entry in value:
        if not isinstance(entry, dict):
            continue
        word = entry.get("word")
        meaning = entry.get("meaning")
        if not isinstance(word, str) or not isinstance(meaning, str):
            continue
        word = word.strip()
        meaning = meaning.strip()
        if word and meaning:
            cleaned.append({"word": word, "meaning": meaning})
    if len(cleaned) < 5:
        logger.error("DeepSeek vocabulary has %s usable entries", len(cleaned))
        return None
    return cleaned[:5]


def _comments_digest(value: object) -> list[dict] | None:
    if not isinstance(value, list):
        logger.error("DeepSeek comments_digest is missing")
        return None
    cleaned: list[dict] = []
    for entry in value:
        if not isinstance(entry, dict):
            continue
        author = entry.get("author")
        point = entry.get("point")
        if not isinstance(point, str) or not point.strip():
            continue
        author_text = author.strip() if isinstance(author, str) else ""
        cleaned.append({"author": author_text or "unknown", "point": point.strip()})
    if not cleaned:
        logger.error("DeepSeek comments_digest is empty")
        return None
    if len(cleaned) < 3:
        logger.warning("DeepSeek comments_digest is shorter than 3 items")
    return cleaned[:5]
