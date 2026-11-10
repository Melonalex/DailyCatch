import re
from html import unescape

_TAGS = re.compile(r"<[^>]+>")
_SPACE = re.compile(r"\s+")


def plain_text(value: str | None) -> str:
    text = _TAGS.sub(" ", value or "")
    text = unescape(text)
    return _SPACE.sub(" ", text).strip()
