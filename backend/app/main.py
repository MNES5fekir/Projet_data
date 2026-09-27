
from fastapi import FastAPI

from backend.app.api.routes.dataset import router as dataset_router


app = FastAPI(
    version="1.0",
    title="AI DATA ANALYST API"
)


app.include_router(dataset_router)


@app.get("/health")
def health():
    return {"status": "ok"}
