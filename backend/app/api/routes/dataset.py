import logging
from collections.abc import Callable
from contextlib import contextmanager

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel, Field

from backend.app.core.security import get_current_user
from backend.app.schemas.dataset import (
    ChartDataResponse,
    DatasetCreateResponse,
    DatasetDeleteResponse,
    DatasetListResponse,
    DatasetStatisticsResponse,
    DatasetSummaryResponse,
)
from backend.app.services.dataset_service import (
    answer_dataset_question,
    delete_dataset,
    get_dataset_chart_data,
    get_dataset_summary,
    list_datasets,
    upload_dataset,
)


logger = logging.getLogger(__name__)
router = APIRouter(prefix="/datasets", tags=["datasets"])


class QuestionRequest(BaseModel):
    question: str = Field(min_length=1, max_length=1000)


@contextmanager
def _dataset_errors(action: str):
    """Traduit les erreurs du service en réponses HTTP sans exposer les détails internes."""
    try:
        yield
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail="Dataset not found.") from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("Dataset error while trying to %s", action)
        raise HTTPException(status_code=500, detail=f"Unable to {action}.") from exc


def _call(action: str, function: Callable, *args):
    with _dataset_errors(action):
        return function(*args)


@router.post("/upload", response_model=DatasetCreateResponse)
async def upload_dataset_route(
    file: UploadFile = File(...), user: dict = Depends(get_current_user)
):
    """
    Upload un fichier CSV.
    """
    with _dataset_errors("process CSV file"):
        return await upload_dataset(file, user["user_id"])


@router.get("", response_model=DatasetListResponse)
def get_datasets(user: dict = Depends(get_current_user)):
    """
    Retourne la liste des datasets.
    """
    datasets = list_datasets(user["user_id"])
    return {"count": len(datasets), "datasets": datasets}


@router.get("/{dataset_id}/summary", response_model=DatasetSummaryResponse)
def get_summary(dataset_id: str, user: dict = Depends(get_current_user)):
    """
    Retourne le résumé analytique d'un dataset.
    """
    return _call("analyze dataset", get_dataset_summary, dataset_id, user["user_id"])


@router.delete("/{dataset_id}", response_model=DatasetDeleteResponse)
def delete_dataset_route(dataset_id: str, user: dict = Depends(get_current_user)):
    """
    Supprime un dataset.
    """
    return _call("delete dataset", delete_dataset, dataset_id, user["user_id"])


@router.get("/{dataset_id}/statistics", response_model=DatasetStatisticsResponse)
def get_statistics(dataset_id: str, user: dict = Depends(get_current_user)):
    """
    Retourne les statistiques détaillées d'un dataset.
    """
    summary = _call("calculate statistics", get_dataset_summary, dataset_id, user["user_id"])
    analysis = summary["analysis"]
    return {
        "dataset_id": summary["dataset_id"],
        "filename": summary["filename"],
        "statistics": analysis["statistics"],
        "columns": analysis["columns"],
        "correlations": analysis["correlations"],
        "outliers": analysis["outliers"],
    }


@router.get("/{dataset_id}/chart-data", response_model=ChartDataResponse)
def get_chart_data(dataset_id: str, user: dict = Depends(get_current_user)):
    """
    Retourne les données nécessaires aux graphiques.
    """
    return _call("prepare chart data", get_dataset_chart_data, dataset_id, user["user_id"])


@router.post("/{dataset_id}/ask")
def ask_dataset(
    dataset_id: str,
    request: QuestionRequest,
    user: dict = Depends(get_current_user),
):
    return _call("answer question", answer_dataset_question, dataset_id, user["user_id"], request.question)
