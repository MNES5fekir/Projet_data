from fastapi import APIRouter, File, HTTPException, UploadFile

from backend.app.services.dataset_service import analyze_csv_upload


router = APIRouter(prefix="/analysis", tags=["analysis"])


@router.post("")
async def analyze_upload(file: UploadFile = File(...)):
    try:
        return await analyze_csv_upload(file)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail=f"Impossible d’analyser ce CSV : {exc}",
        ) from exc