import json
import unittest
from datetime import date, datetime

from fastapi.encoders import jsonable_encoder

from api.repository import _hot_topic, _issue, _item, _lesson
from api.schemas import Digest, Health


class ContractTest(unittest.TestCase):
    def test_health_body(self):
        self.assertEqual(jsonable_encoder(Health(status="ok")), {"status": "ok"})

    def test_issue_date_is_calendar_day(self):
        encoded = jsonable_encoder(
            _issue(
                {
                    "digest_date": datetime(2026, 11, 11, 8, 30, 0),
                    "title": None,
                    "article_type": None,
                    "difficulty": None,
                    "topic": None,
                }
            )
        )
        self.assertEqual(
            encoded,
            {
                "date": "2026-11-11",
                "title": None,
                "article_type": None,
                "difficulty": None,
                "topic": None,
            },
        )

    def test_issue_keeps_lesson_fields(self):
        encoded = jsonable_encoder(
            _issue(
                {
                    "digest_date": date(2026, 11, 11),
                    "title": "A quiet morning",
                    "article_type": "daily",
                    "difficulty": "Everyday English",
                    "topic": "home",
                }
            )
        )
        self.assertEqual(encoded["date"], "2026-11-11")
        self.assertEqual(encoded["title"], "A quiet morning")
        self.assertEqual(encoded["article_type"], "daily")

    def test_lesson_decodes_json_columns(self):
        vocabulary = [{"word": "run", "pos": "verb", "meaning": "跑", "note": "keep"}]
        encoded = jsonable_encoder(
            _lesson(
                {
                    "article_type": "ielts",
                    "difficulty": "IELTS 6.5-7.5",
                    "topic": "education",
                    "title": "One classroom",
                    "body": json.dumps(["First.", "Second."]),
                    "translation": json.dumps(["一。", "二。"]),
                    "vocabulary": json.dumps(vocabulary),
                }
            )
        )
        self.assertEqual(
            encoded,
            {
                "article_type": "ielts",
                "difficulty": "IELTS 6.5-7.5",
                "topic": "education",
                "title": "One classroom",
                "paragraphs": ["First.", "Second."],
                "translation": ["一。", "二。"],
                "vocabulary": vocabulary,
            },
        )

    def test_lesson_empty_json_becomes_empty_lists(self):
        encoded = jsonable_encoder(
            _lesson(
                {
                    "article_type": "news",
                    "difficulty": "News English",
                    "topic": "current events",
                    "title": "Brief",
                    "body": "",
                    "translation": "not-json",
                    "vocabulary": None,
                }
            )
        )
        self.assertEqual(encoded["paragraphs"], [])
        self.assertEqual(encoded["translation"], [])
        self.assertEqual(encoded["vocabulary"], [])

    def test_hot_topic_passes_quotes_through(self):
        quotes = [{"text": "Hello", "speaker": "Ada", "source_type": "Analyst", "stance": "Doubt"}]
        encoded = jsonable_encoder(
            _hot_topic(
                {
                    "id": 4,
                    "title": "A chip story",
                    "overview": "On 11 Nov, a company said something.",
                    "quotes": quotes,
                    "background": None,
                }
            )
        )
        self.assertEqual(encoded["id"], 4)
        self.assertEqual(encoded["quotes"], quotes)
        self.assertIsNone(encoded["background"])

    def test_item_formats_timestamp_and_keeps_nulls(self):
        encoded = jsonable_encoder(
            _item(
                {
                    "id": 9,
                    "source_type": "hackernews",
                    "source_name": "Hacker News",
                    "title": "Show HN",
                    "url": "https://example.com",
                    "author": None,
                    "points": 12,
                    "comment_count": None,
                    "published_at": datetime(2026, 11, 11, 7, 5, 6),
                    "summary": None,
                    "vocabulary": None,
                    "comments_digest": "",
                }
            )
        )
        self.assertEqual(
            encoded,
            {
                "id": 9,
                "source_type": "hackernews",
                "source_name": "Hacker News",
                "title": "Show HN",
                "url": "https://example.com",
                "author": None,
                "points": 12,
                "comment_count": None,
                "published_at": "2026-11-11 07:05:06",
                "summary": None,
                "vocabulary": None,
                "comments_digest": None,
            },
        )

    def test_digest_keeps_top_level_keys(self):
        encoded = jsonable_encoder(
            Digest(date="2026-11-11", lesson=None, hot_topics=[], items=[])
        )
        self.assertEqual(
            encoded,
            {"date": "2026-11-11", "lesson": None, "hot_topics": [], "items": []},
        )


if __name__ == "__main__":
    unittest.main()
