import logging
import threading
from datetime import datetime, timedelta

from common.config import SHANGHAI, load_settings, today_shanghai
from common.db import connect
from fetcher.main import main as run_fetcher

logger = logging.getLogger("schedule")

RUN_HOUR = 7
RUN_MINUTE = 0


def start_daily_schedule() -> None:
    thread = threading.Thread(target=_loop, name="daily-fetch", daemon=True)
    thread.start()


def _loop() -> None:
    if _past_run_time() and not _lesson_exists(today_shanghai()):
        _run_once()
    while True:
        delay = _seconds_until_next_run()
        logger.info("Next digest fetch in %.0f seconds", delay)
        threading.Event().wait(delay)
        _run_once()


def _run_once() -> None:
    logger.info("Starting scheduled digest fetch")
    try:
        code = run_fetcher([])
    except Exception:
        logger.exception("Scheduled fetch crashed")
        return
    logger.info("Scheduled digest fetch finished with code %s", code)


def _past_run_time() -> bool:
    now = datetime.now(SHANGHAI)
    return (now.hour, now.minute) >= (RUN_HOUR, RUN_MINUTE)


def _seconds_until_next_run() -> float:
    now = datetime.now(SHANGHAI)
    target = now.replace(hour=RUN_HOUR, minute=RUN_MINUTE, second=0, microsecond=0)
    if now >= target:
        target += timedelta(days=1)
    return max(1.0, (target - now).total_seconds())


def _lesson_exists(day) -> bool:
    try:
        connection = connect(load_settings())
    except Exception:
        logger.exception("Could not check today's lesson")
        return True
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1 FROM lessons WHERE digest_date = %s", (day,))
            return cursor.fetchone() is not None
    except Exception:
        logger.exception("Could not check today's lesson")
        return True
    finally:
        connection.close()
