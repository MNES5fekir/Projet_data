from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, File, HTTPException, UploadFile

from backend.app.services.dataset_service import (
    delete_dataset,
    get_dataset_summary,
    list_datasets,
)
from backend.app.schemas.dataset import (
    ChartDataResponse,
    DatasetCreateResponse,
    DatasetDeleteResponse,
    DatasetListResponse,
    DatasetStatisticsResponse,
    DatasetSummaryResponse,
)


from backend.app.services.dataset_service import (
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

UPLOAD_DIR = Path("data/uploads")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

@router.post(
    "/upload",
    response_model=DatasetCreateResponse
)
async def upload_dataset_route(file: UploadFile = File(...)):
    """
    Upload un fichier CSV.
    """

    try:
        return await upload_dataset(file)

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
async def get_datasets():
    """
    Retourne la liste des datasets.
    """

    return {
        "count": len(list_datasets()),
        "datasets": list_datasets()
    }


@router.get("/{dataset_id}/summary", response_model=DatasetSummaryResponse)
async def get_summary(dataset_id: str):
    """
    Retourne le résumé analytique d'un dataset.
    """

    try:
        return get_dataset_summary(dataset_id)

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
async def delete_dataset_route(dataset_id: str):
    """
    Supprime un dataset.
    """

    try:
        return delete_dataset(dataset_id)

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
async def get_statistics(dataset_id: str):
    """
    Retourne les statistiques détaillées d'un dataset.
    """

    try:
        summary = get_dataset_summary(dataset_id)

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
async def get_chart_data(dataset_id: str):
    """
    Retourne les données nécessaires aux graphiques.
    """

    try:
        return get_dataset_chart_data(dataset_id)

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