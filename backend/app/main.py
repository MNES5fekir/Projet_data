import os
from urllib.parse import urlsplit

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.responses import JSONResponse

from backend.app.api.routes.analysis import router as analysis_router
from backend.app.api.routes.analytics import router as analytics_router

app = FastAPI(
    version="1.0",
    title="DataClair API"
)

cors_origins = [
    origin.strip()
    for origin in os.getenv(
        "CORS_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173,http://localhost:5174,http://127.0.0.1:5174",
    ).split(",")
    if origin.strip()
]


app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
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
        if normalized_origin not in cors_origins and normalized_origin != request_origin:
            return JSONResponse(status_code=403, content={"detail": "Origine non autorisée."})
    return await call_next(request)


app.include_router(analysis_router)
app.include_router(analytics_router)


@app.get("/health")
def health():
    return {"status": "ok"}