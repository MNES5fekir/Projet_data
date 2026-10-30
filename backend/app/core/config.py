import os
from pathlib import Path


DEFAULT_CORS_ORIGINS = (
    "http://localhost:5173,http://127.0.0.1:5173,"
    "http://localhost:5174,http://127.0.0.1:5174"
)

DATA_DIR = Path(os.getenv("APP_DATA_DIR", "data"))
UPLOAD_DIR = Path(os.getenv("APP_UPLOAD_DIR", str(DATA_DIR / "uploads")))
ANALYTICS_DB_PATH = Path(os.getenv("ANALYTICS_DB_PATH", str(DATA_DIR / "analytics.sqlite3")))
APP_DB_PATH = DATA_DIR / "app.sqlite3"

COOKIE_SECURE = os.getenv("APP_COOKIE_SECURE", "false").lower() == "true"
# Swagger et le schéma OpenAPI ne sont exposés que si on le demande explicitement (dev).
API_DOCS_ENABLED = os.getenv("API_DOCS_ENABLED", "false").lower() == "true"
CORS_ORIGINS = [
    origin.strip()
    for origin in os.getenv("CORS_ORIGINS", DEFAULT_CORS_ORIGINS).split(",")
    if origin.strip()
]

MAX_UPLOAD_BYTES = 10 * 1024 * 1024
# Un CSV de 10 Mo peut occuper plusieurs centaines de Mo dans pandas :
# on borne le nombre d’analyses simultanées pour ne pas saturer la mémoire.
MAX_CONCURRENT_ANALYSES = int(os.getenv("MAX_CONCURRENT_ANALYSES", "2"))
