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



router = APIRouter(
    prefix="/datasets",
    tags=["datasets"]
)


class QuestionRequest(BaseModel):
    question: str = Field(min_length=1, max_length=1000)

@router.post(
    "/upload",
    response_model=DatasetCreateResponse
)
async def upload_dataset_route(
    file: UploadFile = File(...), user: dict = Depends(get_current_user)
):
    """
    Upload un fichier CSV.
    """

    try:
        return await upload_dataset(file, user["user_id"])

    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail=str(exc)
        )

    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail=f"Unable to process CSV file: {exc}"
        )


@router.get("", response_model=DatasetListResponse)
async def get_datasets(user: dict = Depends(get_current_user)):
    """
    Retourne la liste des datasets.
    """

    return {
        "count": len(list_datasets(user["user_id"])),
        "datasets": list_datasets(user["user_id"])
    }


@router.get("/{dataset_id}/summary", response_model=DatasetSummaryResponse)
async def get_summary(dataset_id: str, user: dict = Depends(get_current_user)):
    """
    Retourne le résumé analytique d'un dataset.
    """

    try:
        return get_dataset_summary(dataset_id, user["user_id"])

    except FileNotFoundError:
        raise HTTPException(
            status_code=404,
            detail="Dataset not found."
        )

    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail=f"Unable to analyze dataset: {exc}"
        )


@router.delete("/{dataset_id}", response_model=DatasetDeleteResponse)
async def delete_dataset_route(dataset_id: str, user: dict = Depends(get_current_user)):
    """
    Supprime un dataset.
    """

    try:
        return delete_dataset(dataset_id, user["user_id"])

    except FileNotFoundError:
        raise HTTPException(
            status_code=404,
            detail="Dataset not found."
        )

    except OSError as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Unable to delete dataset: {exc}"
        )



@router.get(
    "/{dataset_id}/statistics",
    response_model=DatasetStatisticsResponse
)
async def get_statistics(dataset_id: str, user: dict = Depends(get_current_user)):
    """
    Retourne les statistiques détaillées d'un dataset.
    """

    try:
        summary = get_dataset_summary(dataset_id, user["user_id"])

        return {
            "dataset_id": summary["dataset_id"],
            "filename": summary["filename"],
            "statistics": summary["analysis"]["statistics"],
            "columns": summary["analysis"]["columns"],
            "correlations": summary["analysis"]["correlations"],
            "outliers": summary["analysis"]["outliers"],
        }

    except FileNotFoundError:
        raise HTTPException(
            status_code=404,
            detail="Dataset not found."
        )

    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail=f"Unable to calculate statistics: {exc}"
        )


@router.get(
    "/{dataset_id}/chart-data",
    response_model=ChartDataResponse
)
async def get_chart_data(dataset_id: str, user: dict = Depends(get_current_user)):
    """
    Retourne les données nécessaires aux graphiques.
    """

    try:
        return get_dataset_chart_data(dataset_id, user["user_id"])

    except FileNotFoundError:
        raise HTTPException(
            status_code=404,
            detail="Dataset not found."
        )

    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail=f"Unable to prepare chart data: {exc}"
        )


@router.post("/{dataset_id}/ask")
async def ask_dataset(
    dataset_id: str,
    request: QuestionRequest,
    user: dict = Depends(get_current_user),
):
    try:
        return answer_dataset_question(dataset_id, user["user_id"], request.question)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Dataset not found.")