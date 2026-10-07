import hashlib
import os
import sqlite3
import time
from pathlib import Path


DATA_DIR = Path(os.getenv("APP_DATA_DIR", "data"))
DATABASE_PATH = Path(
    os.getenv("ANALYTICS_DB_PATH", str(DATA_DIR / "analytics.sqlite3"))
)
RETENTION_SECONDS = 60 * 60 * 24 * 180
EVENT_NAMES = {
    "page_view",
    "section_view",
    "file_selected",
    "analysis_started",
    "analysis_succeeded",
    "analysis_failed",
    "report_downloaded",
}
SECTIONS = {
    "home",
    "upload",
    "results",
    "distribution",
    "categories",
    "correlations",
    "scatter",
    "statistics",
    "quality",
}


def _connect() -> sqlite3.Connection:
    DATABASE_PATH.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(DATABASE_PATH, timeout=10)
    connection.row_factory = sqlite3.Row
    return connection


def initialize_database() -> None:
    with _connect() as connection:
        connection.execute(
            """CREATE TABLE IF NOT EXISTS analytics_events (
                event_id INTEGER PRIMARY KEY AUTOINCREMENT,
                visitor_hash TEXT NOT NULL,
                event_name TEXT NOT NULL,
                section TEXT,
                created_at INTEGER NOT NULL
            )"""
        )
        connection.execute(
            "CREATE INDEX IF NOT EXISTS analytics_created_at_idx ON analytics_events(created_at)"
        )
        connection.execute(
            "CREATE INDEX IF NOT EXISTS analytics_visitor_hash_idx ON analytics_events(visitor_hash)"
        )


def _visitor_hash(visitor_id: str) -> str:
    return hashlib.sha256(visitor_id.encode("utf-8")).hexdigest()


def record_event(visitor_id: str, event_name: str, section: str | None = None) -> None:
    if event_name not in EVENT_NAMES:
        raise ValueError("Événement non autorisé.")
    if section is not None and section not in SECTIONS:
        raise ValueError("Section non autorisée.")

    now = int(time.time())
    visitor_hash = _visitor_hash(visitor_id)
    with _connect() as connection:
        connection.execute(
            "DELETE FROM analytics_events WHERE created_at < ?",
            (now - RETENTION_SECONDS,),
        )
        recent_events = connection.execute(
            "SELECT COUNT(*) FROM analytics_events WHERE visitor_hash = ? AND created_at > ?",
            (visitor_hash, now - 60),
        ).fetchone()[0]
        if recent_events >= 30:
            raise RuntimeError("Trop d’événements reçus. Réessayez dans une minute.")
        connection.execute(
            """INSERT INTO analytics_events (visitor_hash, event_name, section, created_at)
               VALUES (?, ?, ?, ?)""",
            (visitor_hash, event_name, section, now),
        )


def revoke_visitor(visitor_id: str | None) -> None:
    if not visitor_id:
        return
    with _connect() as connection:
        connection.execute(
            "DELETE FROM analytics_events WHERE visitor_hash = ?",
            (_visitor_hash(visitor_id),),
        )


def get_analytics_summary() -> dict:
    now = int(time.time())
    since = now - 7 * 24 * 60 * 60
    with _connect() as connection:
        connection.execute(
            "DELETE FROM analytics_events WHERE created_at < ?",
            (now - RETENTION_SECONDS,),
        )
        totals = connection.execute(
            """SELECT COUNT(DISTINCT visitor_hash) AS visitors,
                      SUM(CASE WHEN event_name IN ('page_view', 'section_view') THEN 1 ELSE 0 END) AS views,
                      COUNT(*) AS events
               FROM analytics_events"""
        ).fetchone()
        recent = connection.execute(
            "SELECT COUNT(DISTINCT visitor_hash) FROM analytics_events WHERE created_at >= ?",
            (since,),
        ).fetchone()[0]
        sections = connection.execute(
            """SELECT section, COUNT(*) AS views, COUNT(DISTINCT visitor_hash) AS visitors
               FROM analytics_events WHERE event_name IN ('page_view', 'section_view')
               GROUP BY section ORDER BY views DESC LIMIT 10"""
        ).fetchall()
        actions = connection.execute(
            """SELECT event_name, COUNT(*) AS count, COUNT(DISTINCT visitor_hash) AS visitors
               FROM analytics_events WHERE event_name NOT IN ('page_view', 'section_view')
               GROUP BY event_name ORDER BY count DESC"""
        ).fetchall()
        daily = connection.execute(
            """SELECT date(created_at, 'unixepoch') AS day,
                      COUNT(DISTINCT visitor_hash) AS visitors,
                      SUM(CASE WHEN event_name = 'page_view' THEN 1 ELSE 0 END) AS views
               FROM analytics_events WHERE created_at >= ?
               GROUP BY day ORDER BY day""",
            (since,),
        ).fetchall()

    return {
        "visitors_total": totals["visitors"] or 0,
        "visitors_7d": recent,
        "views_total": totals["views"] or 0,
        "events_total": totals["events"] or 0,
        "sections": [dict(row) for row in sections],
        "actions": [dict(row) for row in actions],
        "daily": [dict(row) for row in daily],
        "retention_days": RETENTION_SECONDS // (24 * 60 * 60),
    }


initialize_database()