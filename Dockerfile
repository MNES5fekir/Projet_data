FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    APP_DATA_DIR=/app/data \
    APP_UPLOAD_DIR=/app/data/uploads \
    ANALYTICS_DB_PATH=/app/data/analytics.sqlite3

WORKDIR /app

COPY requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY backend ./backend
RUN useradd --system --uid 10001 app \
    && mkdir -p /app/data/uploads \
    && chown -R app:app /app/data

USER app
EXPOSE 8000

CMD ["uvicorn", "backend.app.main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers", "--forwarded-allow-ips", "*"]