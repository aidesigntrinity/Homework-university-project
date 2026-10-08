"""Tiny SQLite store: one row per Telegram user, plus a log of sent reminders."""

import sqlite3
import threading
from dataclasses import dataclass
from pathlib import Path


@dataclass
class User:
    chat_id: int
    feed_url: str
    timezone: str
    remind_hours: list[int]  # e.g. [24, 3]; empty = no deadline reminders
    digest_time: str | None  # "HH:MM" local time, None = no daily digest
    ignore_words: list[str]


_SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    chat_id      INTEGER PRIMARY KEY,
    feed_url     TEXT NOT NULL,
    timezone     TEXT NOT NULL,
    remind_hours TEXT NOT NULL DEFAULT '24,3',
    digest_time  TEXT DEFAULT '08:00',
    ignore_words TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS sent (
    chat_id INTEGER NOT NULL,
    kind    TEXT NOT NULL,
    key     TEXT NOT NULL,
    sent_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (chat_id, kind, key)
);
"""


def _split_ints(value: str) -> list[int]:
    return [int(x) for x in value.split(",") if x.strip()]


class Storage:
    def __init__(self, path: str):
        if path != ":memory:":
            Path(path).parent.mkdir(parents=True, exist_ok=True)
        self._lock = threading.Lock()
        self._db = sqlite3.connect(path, check_same_thread=False)
        self._db.row_factory = sqlite3.Row
        self._db.executescript(_SCHEMA)
        if path != ":memory:":
            # The database holds secret calendar URLs.
            Path(path).chmod(0o600)

    def _row_to_user(self, row: sqlite3.Row) -> User:
        return User(
            chat_id=row["chat_id"],
            feed_url=row["feed_url"],
            timezone=row["timezone"],
            remind_hours=_split_ints(row["remind_hours"]),
            digest_time=row["digest_time"],
            ignore_words=[w for w in row["ignore_words"].split("\n") if w],
        )

    def get_user(self, chat_id: int) -> User | None:
        with self._lock:
            row = self._db.execute("SELECT * FROM users WHERE chat_id = ?", (chat_id,)).fetchone()
        return self._row_to_user(row) if row else None

    def all_users(self) -> list[User]:
        with self._lock:
            rows = self._db.execute("SELECT * FROM users").fetchall()
        return [self._row_to_user(r) for r in rows]

    def save_feed(self, chat_id: int, feed_url: str, default_timezone: str) -> None:
        """Create the user or replace their feed URL, keeping other settings."""
        with self._lock, self._db:
            self._db.execute(
                "INSERT INTO users (chat_id, feed_url, timezone) VALUES (?, ?, ?) "
                "ON CONFLICT(chat_id) DO UPDATE SET feed_url = excluded.feed_url",
                (chat_id, feed_url, default_timezone),
            )
            self._db.execute("DELETE FROM sent WHERE chat_id = ? AND kind = 'feed_error'", (chat_id,))

    def delete_user(self, chat_id: int) -> None:
        with self._lock, self._db:
            self._db.execute("DELETE FROM users WHERE chat_id = ?", (chat_id,))
            self._db.execute("DELETE FROM sent WHERE chat_id = ?", (chat_id,))

    def update_setting(self, chat_id: int, column: str, value: object) -> None:
        if column not in {"timezone", "remind_hours", "digest_time", "ignore_words"}:
            raise ValueError(column)
        if column == "remind_hours":
            value = ",".join(str(h) for h in value)  # type: ignore[union-attr]
        elif column == "ignore_words":
            value = "\n".join(value)  # type: ignore[arg-type]
        with self._lock, self._db:
            self._db.execute(f"UPDATE users SET {column} = ? WHERE chat_id = ?", (value, chat_id))

    # --- sent-log -----------------------------------------------------------

    def was_sent(self, chat_id: int, kind: str, key: str) -> bool:
        with self._lock:
            row = self._db.execute(
                "SELECT 1 FROM sent WHERE chat_id = ? AND kind = ? AND key = ?",
                (chat_id, kind, key),
            ).fetchone()
        return row is not None

    def mark_sent(self, chat_id: int, kind: str, key: str) -> None:
        with self._lock, self._db:
            self._db.execute(
                "INSERT OR IGNORE INTO sent (chat_id, kind, key) VALUES (?, ?, ?)",
                (chat_id, kind, key),
            )

    def clear_sent(self, chat_id: int, kind: str, key: str) -> None:
        with self._lock, self._db:
            self._db.execute(
                "DELETE FROM sent WHERE chat_id = ? AND kind = ? AND key = ?", (chat_id, kind, key)
            )

    def prune_sent(self, days: int = 60) -> None:
        with self._lock, self._db:
            self._db.execute(
                "DELETE FROM sent WHERE kind != 'feed_error' AND sent_at < datetime('now', ?)",
                (f"-{days} days",),
            )
