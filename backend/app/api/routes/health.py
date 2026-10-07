from fastapi import FastAPI

app = FastAPI(
    version= "1.0",
    title=" AI DATA ANALYST API"

)

app.get("/health")
def health():
    return{"status": "ok"}