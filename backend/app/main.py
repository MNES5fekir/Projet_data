from urllib.parse import urlsplit

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.responses import JSONResponse

from backend.app.api.routes.analysis import router as analysis_router
from backend.app.api.routes.analytics import router as analytics_router
from backend.app.api.routes.health import router as health_router
from backend.app.core.config import API_DOCS_ENABLED, CORS_ORIGINS
from backend.app.core.logging import configure_logging


configure_logging()

app = FastAPI(
    version="1.0",
    title="DataClair API",
    docs_url="/docs" if API_DOCS_ENABLED else None,
    redoc_url="/redoc" if API_DOCS_ENABLED else None,
    openapi_url="/openapi.json" if API_DOCS_ENABLED else None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def verify_request_origin(request, call_next):
    origin = request.headers.get("origin")
    if origin and request.method in {"POST", "PUT", "PATCH", "DELETE"}:
        parsed_origin = urlsplit(origin)
        normalized_origin = f"{parsed_origin.scheme}://{parsed_origin.netloc}"
        request_origin = f"{request.url.scheme}://{request.url.netloc}"
        if normalized_origin not in CORS_ORIGINS and normalized_origin != request_origin:
            return JSONResponse(status_code=403, content={"detail": "Origine non autorisée."})
    return await call_next(request)


app.include_router(health_router)
app.include_router(analysis_router)
app.include_router(analytics_router)
