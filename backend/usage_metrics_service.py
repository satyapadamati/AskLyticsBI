import os
from datetime import datetime, timedelta
from typing import List, Dict

import psycopg2
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv

load_dotenv(override=True)

PG_HOST = os.getenv("PG_HOST", "localhost")
PG_PORT = int(os.getenv("PG_PORT", 5432))
PG_DB = os.getenv("PG_DATABASE", "gen_bi_agent_db")
PG_USER = os.getenv("PG_USER", "postgres")
PG_PASS = os.getenv("PG_PASSWORD", "")
PG_SCHEMA = os.getenv("PG_SCHEMA", "clinical")


def _safe_ident(name: str) -> str:
    text = (name or "").strip()
    if not text:
        return "clinical"
    if not all(ch.isalnum() or ch == "_" for ch in text):
        return "clinical"
    return text


def _table_name() -> str:
    schema = _safe_ident(PG_SCHEMA)
    return f"{schema}.usage_metrics"


def _connect():
    return psycopg2.connect(
        host=PG_HOST,
        port=PG_PORT,
        dbname=PG_DB,
        user=PG_USER,
        password=PG_PASS,
        connect_timeout=10,
    )


def init_usage_metrics_table() -> None:
    schema = _safe_ident(PG_SCHEMA)
    table = _table_name()
    conn = _connect()
    cur = conn.cursor()
    try:
        cur.execute(f"CREATE SCHEMA IF NOT EXISTS {schema}")
        cur.execute(
            f"""
            CREATE TABLE IF NOT EXISTS {table} (
                id BIGSERIAL PRIMARY KEY,
                username TEXT NOT NULL,
                prompt_text TEXT NOT NULL,
                prompt_tokens INTEGER NOT NULL DEFAULT 0,
                completion_tokens INTEGER NOT NULL DEFAULT 0,
                total_tokens INTEGER NOT NULL DEFAULT 0,
                response_ms INTEGER NOT NULL DEFAULT 0,
                sql_generation_ms INTEGER NOT NULL DEFAULT 0,
                query_execution_ms INTEGER NOT NULL DEFAULT 0,
                chart_config_ms INTEGER NOT NULL DEFAULT 0,
                summary_ms INTEGER NOT NULL DEFAULT 0,
                status TEXT NOT NULL DEFAULT 'success',
                error_message TEXT,
                model TEXT,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
            """
        )
        cur.execute(
            f"""
            CREATE INDEX IF NOT EXISTS idx_usage_metrics_user_created
            ON {table} (username, created_at DESC)
            """
        )
        conn.commit()
    finally:
        cur.close()
        conn.close()


def log_usage_metric(
    username: str,
    prompt_text: str,
    prompt_tokens: int,
    completion_tokens: int,
    total_tokens: int,
    response_ms: int,
    sql_generation_ms: int,
    query_execution_ms: int,
    chart_config_ms: int,
    summary_ms: int,
    status: str = "success",
    error_message: str = "",
    model: str = "",
) -> None:
    table = _table_name()
    conn = _connect()
    cur = conn.cursor()
    try:
        cur.execute(
            f"""
            INSERT INTO {table} (
                username,
                prompt_text,
                prompt_tokens,
                completion_tokens,
                total_tokens,
                response_ms,
                sql_generation_ms,
                query_execution_ms,
                chart_config_ms,
                summary_ms,
                status,
                error_message,
                model
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (
                (username or "anonymous").strip() or "anonymous",
                (prompt_text or "").strip(),
                int(prompt_tokens or 0),
                int(completion_tokens or 0),
                int(total_tokens or 0),
                int(response_ms or 0),
                int(sql_generation_ms or 0),
                int(query_execution_ms or 0),
                int(chart_config_ms or 0),
                int(summary_ms or 0),
                (status or "success").strip(),
                (error_message or "").strip() or None,
                (model or "").strip() or None,
            ),
        )
        conn.commit()
    finally:
        cur.close()
        conn.close()


def get_usage_metrics(username: str, since_days: int = 365, limit: int = 300) -> List[Dict]:
    table = _table_name()
    conn = _connect()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        since_days = max(1, int(since_days or 365))
        limit = max(1, min(int(limit or 300), 2000))
        since_dt = datetime.utcnow() - timedelta(days=since_days)
        cur.execute(
            f"""
            SELECT
                username,
                prompt_text,
                prompt_tokens,
                completion_tokens,
                total_tokens,
                response_ms,
                sql_generation_ms,
                query_execution_ms,
                chart_config_ms,
                summary_ms,
                status,
                error_message,
                model,
                created_at
            FROM {table}
            WHERE username = %s
              AND created_at >= %s
            ORDER BY created_at DESC
            LIMIT %s
            """,
            (((username or "anonymous").strip() or "anonymous"), since_dt, limit),
        )
        rows = cur.fetchall() or []
        result = []
        for r in rows:
            row = dict(r)
            created_at = row.get("created_at")
            if created_at is not None:
                try:
                    row["created_at"] = created_at.isoformat()
                except Exception:
                    row["created_at"] = str(created_at)
            result.append(row)
        return result
    finally:
        cur.close()
        conn.close()
