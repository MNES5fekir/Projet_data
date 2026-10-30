import hashlib
import hmac
import secrets
import sqlite3
import time
from uuid import uuid4

from fastapi import HTTPException, Request, status

from backend.app.core.config import APP_DB_PATH as DATABASE_PATH
from backend.app.core.config import COOKIE_SECURE
from backend.app.core.exceptions import UserAlreadyExistsError


SESSION_COOKIE = "data_session"
SESSION_TTL = 60 * 60 * 24 * 7
PBKDF2_ITERATIONS = 310_000


def _connect() -> sqlite3.Connection:
    DATABASE_PATH.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(DATABASE_PATH, timeout=10)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    return connection


def initialize_database() -> None:
    with _connect() as connection:
        connection.execute("PRAGMA journal_mode = WAL")
        connection.executescript(
            """
            CREATE TABLE IF NOT EXISTS users (
                user_id TEXT PRIMARY KEY,
                email TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                created_at INTEGER NOT NULL
            );
            CREATE TABLE IF NOT EXISTS sessions (
                token_hash TEXT PRIMARY KEY,
                user_id TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
                expires_at INTEGER NOT NULL
            );
            CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions(user_id);
            """
        )


def _hash_password(password: str, salt: bytes | None = None) -> str:
    salt = salt or secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac(
        "sha256", password.encode("utf-8"), salt, PBKDF2_ITERATIONS
    )
    return f"{salt.hex()}:{digest.hex()}"


def _verify_password(password: str, stored_hash: str) -> bool:
    salt_hex, digest_hex = stored_hash.split(":", maxsplit=1)
    candidate = _hash_password(password, bytes.fromhex(salt_hex))
    return hmac.compare_digest(candidate, f"{salt_hex}:{digest_hex}")


# Hash factice : un e-mail inconnu coûte le même temps de calcul qu'un e-mail connu,
# ce qui empêche de deviner les comptes existants via le temps de réponse.
_DUMMY_PASSWORD_HASH = _hash_password(secrets.token_urlsafe(16))


def create_user(email: str, password: str) -> dict:
    normalized_email = email.strip().lower()
    if len(normalized_email) > 254 or "@" not in normalized_email:
        raise ValueError("Veuillez saisir une adresse e-mail valide.")
    if len(password) < 12:
        raise ValueError("Le mot de passe doit contenir au moins 12 caractères.")

    user = {
        "user_id": str(uuid4()),
        "email": normalized_email,
        "password_hash": _hash_password(password),
        "created_at": int(time.time()),
    }
    try:
        with _connect() as connection:
            connection.execute(
                "INSERT INTO users (user_id, email, password_hash, created_at) VALUES (?, ?, ?, ?)",
                (user["user_id"], user["email"], user["password_hash"], user["created_at"]),
            )
    except sqlite3.IntegrityError as exc:
        raise UserAlreadyExistsError("Un compte existe déjà avec cette adresse e-mail.") from exc
    return {"user_id": user["user_id"], "email": user["email"]}


def authenticate_user(email: str, password: str) -> dict | None:
    with _connect() as connection:
        user = connection.execute(
            "SELECT user_id, email, password_hash FROM users WHERE email = ?",
            (email.strip().lower(),),
        ).fetchone()
    if user is None:
        _verify_password(password, _DUMMY_PASSWORD_HASH)
        return None
    if not _verify_password(password, user["password_hash"]):
        return None
    return {"user_id": user["user_id"], "email": user["email"]}


def create_session(user_id: str) -> str:
    token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()
    expires_at = int(time.time()) + SESSION_TTL
    with _connect() as connection:
        connection.execute("DELETE FROM sessions WHERE expires_at <= ?", (int(time.time()),))
        connection.execute(
            "INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)",
            (token_hash, user_id, expires_at),
        )
    return token


def get_session_user(token: str | None) -> dict | None:
    if not token:
        return None
    token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()
    with _connect() as connection:
        row = connection.execute(
            """SELECT users.user_id, users.email FROM sessions
               JOIN users ON users.user_id = sessions.user_id
               WHERE sessions.token_hash = ? AND sessions.expires_at > ?""",
            (token_hash, int(time.time())),
        ).fetchone()
    return dict(row) if row else None


def revoke_session(token: str | None) -> None:
    if not token:
        return
    token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()
    with _connect() as connection:
        connection.execute("DELETE FROM sessions WHERE token_hash = ?", (token_hash,))


def get_current_user(request: Request) -> dict:
    user = get_session_user(request.cookies.get(SESSION_COOKIE))
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Veuillez vous connecter pour continuer.",
        )
    return user


initialize_database()