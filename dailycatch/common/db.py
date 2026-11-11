from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path

import pymysql
from pymysql.cursors import DictCursor

from common.config import Settings

SCHEMA_PATH = Path(__file__).resolve().parents[2] / "schema.sql"


def connect(settings: Settings, *, dictionary: bool = False):
    return pymysql.connect(
        host=settings.db_host,
        port=settings.db_port,
        user=settings.db_user,
        password=settings.db_password,
        database=settings.db_name,
        charset="utf8mb4",
        cursorclass=DictCursor if dictionary else pymysql.cursors.Cursor,
        autocommit=False,
    )


@contextmanager
def open_connection(settings: Settings, *, dictionary: bool = False) -> Iterator[pymysql.Connection]:
    connection = connect(settings, dictionary=dictionary)
    try:
        yield connection
    finally:
        connection.close()


def ensure_schema(connection) -> None:
    sql = SCHEMA_PATH.read_text(encoding="utf-8")
    with connection.cursor() as cursor:
        for statement in _statements(sql):
            cursor.execute(statement)
    connection.commit()


def _statements(sql: str) -> list[str]:
    kept_lines: list[str] = []
    for line in sql.splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("--"):
            continue
        kept_lines.append(line)
    body = "\n".join(kept_lines)
    return [part.strip() for part in body.split(";") if part.strip()]
