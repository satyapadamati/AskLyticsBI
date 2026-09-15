import os
import sqlite3
import secrets
import hashlib
from datetime import datetime, timedelta
from typing import Optional, Dict

BASE_DIR = os.path.dirname(__file__)
AUTH_DB_PATH = os.path.join(BASE_DIR, "auth.db")
SESSION_TTL_DAYS = 30


def _utc_now() -> datetime:
    return datetime.utcnow()


def _connect() -> sqlite3.Connection:
    conn = sqlite3.connect(AUTH_DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_auth_db() -> None:
    conn = _connect()
    cur = conn.cursor()
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            salt TEXT NOT NULL,
            created_at TEXT NOT NULL
        )
        """
    )
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS sessions (
            token TEXT PRIMARY KEY,
            user_id INTEGER NOT NULL,
            created_at TEXT NOT NULL,
            expires_at TEXT NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
        """
    )
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS token_usage (
            user_id TEXT NOT NULL,
            usage_date TEXT NOT NULL,
            used_tokens INTEGER NOT NULL DEFAULT 0,
            PRIMARY KEY (user_id, usage_date)
        )
        """
    )
    conn.commit()
    conn.close()


def _normalize_user_id(user_id: str) -> str:
    uid = (user_id or "anonymous").strip()
    return uid if uid else "anonymous"


def _hash_password(password: str, salt: str) -> str:
    digest = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        bytes.fromhex(salt),
        120000,
    )
    return digest.hex()


def create_user(username: str, password: str) -> Dict:
    uname = (username or "").strip().lower()
    if len(uname) < 3:
        raise ValueError("Username must be at least 3 characters")
    if len(password or "") < 6:
        raise ValueError("Password must be at least 6 characters")

    salt = secrets.token_hex(16)
    password_hash = _hash_password(password, salt)
    now = _utc_now().isoformat()

    conn = _connect()
    cur = conn.cursor()
    try:
        cur.execute(
            "INSERT INTO users (username, password_hash, salt, created_at) VALUES (?, ?, ?, ?)",
            (uname, password_hash, salt, now),
        )
        conn.commit()
    except sqlite3.IntegrityError:
        conn.close()
        raise ValueError("Username already exists")

    user_id = cur.lastrowid
    conn.close()
    return {"id": user_id, "username": uname}


def _create_session_token(user_id: int) -> str:
    token = secrets.token_urlsafe(32)
    now = _utc_now()
    expires = now + timedelta(days=SESSION_TTL_DAYS)

    conn = _connect()
    cur = conn.cursor()
    cur.execute(
        "INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)",
        (token, user_id, now.isoformat(), expires.isoformat()),
    )
    conn.commit()
    conn.close()
    return token


def sign_in(username: str, password: str) -> Dict:
    uname = (username or "").strip().lower()
    conn = _connect()
    cur = conn.cursor()
    cur.execute(
        "SELECT id, username, password_hash, salt FROM users WHERE username = ?",
        (uname,),
    )
    row = cur.fetchone()
    conn.close()

    if not row:
        raise ValueError("Invalid username or password")

    expected_hash = _hash_password(password or "", row["salt"])
    if expected_hash != row["password_hash"]:
        raise ValueError("Invalid username or password")

    token = _create_session_token(int(row["id"]))
    return {
        "token": token,
        "user": {
            "id": int(row["id"]),
            "username": row["username"],
        },
    }


def get_user_from_token(token: str) -> Optional[Dict]:
    if not token:
        return None

    now = _utc_now().isoformat()
    conn = _connect()
    cur = conn.cursor()

    # Cleanup expired sessions opportunistically.
    cur.execute("DELETE FROM sessions WHERE expires_at < ?", (now,))

    cur.execute(
        """
        SELECT u.id, u.username, s.expires_at
        FROM sessions s
        JOIN users u ON u.id = s.user_id
        WHERE s.token = ? AND s.expires_at >= ?
        """,
        (token, now),
    )
    row = cur.fetchone()
    conn.commit()
    conn.close()

    if not row:
        return None

    return {
        "id": int(row["id"]),
        "username": row["username"],
        "expires_at": row["expires_at"],
    }


def logout(token: str) -> None:
    if not token:
        return
    conn = _connect()
    cur = conn.cursor()
    cur.execute("DELETE FROM sessions WHERE token = ?", (token,))
    conn.commit()
    conn.close()


def record_token_usage(user_id: str, usage_date: str, consumed_tokens: int, key_hash: str = "") -> None:
    uid = _normalize_user_id(user_id)
    consumed = int(consumed_tokens or 0)
    if consumed <= 0:
        return

    conn = _connect()
    cur = conn.cursor()
    # Ensure key_hash column exists (migrate old schema transparently)
    cur.execute("PRAGMA table_info(token_usage)")
    cols = [r[1] for r in cur.fetchall()]
    if "key_hash" not in cols:
        cur.execute("ALTER TABLE token_usage ADD COLUMN key_hash TEXT NOT NULL DEFAULT ''")
    cur.execute(
        """
        INSERT INTO token_usage (user_id, usage_date, used_tokens, key_hash)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(user_id, usage_date)
        DO UPDATE SET
            used_tokens = CASE
                WHEN excluded.key_hash != '' AND token_usage.key_hash != '' AND excluded.key_hash != token_usage.key_hash
                THEN excluded.used_tokens
                ELSE token_usage.used_tokens + excluded.used_tokens
            END,
            key_hash = excluded.key_hash
        """,
        (uid, usage_date, consumed, key_hash or ""),
    )
    conn.commit()
    conn.close()


def get_token_usage_rows(user_id: str, since_date: str = None) -> list:
    uid = _normalize_user_id(user_id)
    conn = _connect()
    cur = conn.cursor()
    if since_date:
        cur.execute(
            """
            SELECT usage_date, used_tokens
            FROM token_usage
            WHERE user_id = ? AND usage_date >= ?
            ORDER BY usage_date ASC
            """,
            (uid, since_date),
        )
    else:
        cur.execute(
            """
            SELECT usage_date, used_tokens
            FROM token_usage
            WHERE user_id = ?
            ORDER BY usage_date ASC
            """,
            (uid,),
        )
    rows = cur.fetchall()
    conn.close()
    return [(row["usage_date"], int(row["used_tokens"])) for row in rows]
