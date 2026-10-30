import logging

from fastapi import APIRouter, File, HTTPException, UploadFile

from backend.app.services.dataset_service import analyze_csv_upload


logger = logging.getLogger(__name__)
router = APIRouter(prefix="/analysis", tags=["analysis"])


@router.post("")
async def analyze_upload(file: UploadFile = File(...)):
    try:
        return await analyze_csv_upload(file)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("Échec de l’analyse CSV")
        raise HTTPException(
            status_code=500,
            detail="Impossible d’analyser ce CSV. Vérifiez son format.",
        ) from exc
