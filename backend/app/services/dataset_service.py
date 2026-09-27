from pathlib import Path
from uuid import uuid4
from pathlib import Path

from fastapi import UploadFile

from backend.app.analysis.profiler import profile_dataframe
from backend.app.ingestion.loader import load_csv
from backend.app.ingestion.validator import validate_file_extension
from backend.app.analysis.profiler import profile_dataframe
from backend.app.ingestion.loader import load_csv


UPLOAD_DIR = Path("data/uploads")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


def find_dataset(dataset_id: str) -> Path | None:
    """
    Recherche le fichier correspondant à un dataset_id.
    """

    matching_files = list(UPLOAD_DIR.glob(f"{dataset_id}_*"))

    if not matching_files:
        return None

    return matching_files[0]


def get_dataset_summary(dataset_id: str) -> dict:
    """
    Charge et analyse un dataset.
    """

    file_path = find_dataset(dataset_id)

    if file_path is None:
        raise FileNotFoundError("Dataset not found.")

    dataframe = load_csv(file_path)

    return {
        "dataset_id": dataset_id,
        "filename": file_path.name.removeprefix(f"{dataset_id}_"),
        "analysis": profile_dataframe(dataframe)
    }


def list_datasets() -> list[dict]:
    """
    Retourne tous les datasets disponibles.
    """

    datasets = []

    for file_path in UPLOAD_DIR.iterdir():
        if not file_path.is_file():
            continue

        filename = file_path.name

        if "_" not in filename:
            continue

        dataset_id, original_filename = filename.split("_", 1)

        datasets.append({
            "dataset_id": dataset_id,
            "filename": original_filename,
            "size_bytes": file_path.stat().st_size
        })

    return datasets


def delete_dataset(dataset_id: str) -> dict:
    """
    Supprime un dataset.
    """

    file_path = find_dataset(dataset_id)

    if file_path is None:
        raise FileNotFoundError("Dataset not found.")

    filename = file_path.name.removeprefix(f"{dataset_id}_")

    file_path.unlink()

    return {
        "dataset_id": dataset_id,
        "filename": filename,
        "deleted": True
    }



async def upload_dataset(file: UploadFile) -> dict:
    """
    Enregistre un fichier CSV et retourne son analyse.
    """

    if not file.filename:
        raise ValueError("Filename is missing.")

    if not validate_file_extension(file.filename):
        raise ValueError("Only CSV files are allowed.")

    dataset_id = str(uuid4())

    # Évite d'utiliser un chemin fourni par le client.
    original_filename = Path(file.filename).name

    filename = f"{dataset_id}_{original_filename}"
    file_path = UPLOAD_DIR / filename

    content = await file.read()

    try:
        with open(file_path, "wb") as buffer:
            buffer.write(content)

        dataframe = load_csv(file_path)

        return {
            "dataset_id": dataset_id,
            "filename": original_filename,
            "rows": len(dataframe),
            "columns": len(dataframe.columns),
            "analysis": profile_dataframe(dataframe),
        }

    except Exception:
        file_path.unlink(missing_ok=True)
        raise

    finally:
        await file.close()


def get_dataset_chart_data(dataset_id: str) -> dict:
    """
    Prépare les données nécessaires aux graphiques.
    """

    file_path = find_dataset(dataset_id)

    if file_path is None:
        raise FileNotFoundError("Dataset not found.")

    dataframe = load_csv(file_path)

    # --------------------------------------------------
    # 1. HISTOGRAMMES
    # --------------------------------------------------

    numeric_dataframe = dataframe.select_dtypes(
        include="number"
    )

    histograms = []

    for column in numeric_dataframe.columns:
        values = (
            numeric_dataframe[column]
            .dropna()
            .tolist()
        )

        histograms.append({
            "column": column,
            "values": [
                float(value)
                for value in values
            ]
        })

    # --------------------------------------------------
    # 2. DONNEES CATEGORIELLES
    # --------------------------------------------------

    categorical_columns = dataframe.select_dtypes(
        exclude="number"
    ).columns

    categories = []

    for column in categorical_columns:
        counts = (
            dataframe[column]
            .dropna()
            .astype(str)
            .value_counts()
            .head(20)
        )

        categories.append({
            "column": column,
            "labels": [
                str(label)
                for label in counts.index.tolist()
            ],
            "values": [
                int(value)
                for value in counts.values.tolist()
            ]
        })

    # --------------------------------------------------
    # 3. SCATTER PLOTS
    # --------------------------------------------------

    scatter = []

    numeric_columns = list(
        numeric_dataframe.columns
    )

    for index, x_column in enumerate(numeric_columns):
        for y_column in numeric_columns[index + 1:]:
            pair = dataframe[
                [x_column, y_column]
            ].dropna()

            scatter.append({
                "x_column": x_column,
                "y_column": y_column,
                "x_values": [
                    float(value)
                    for value in pair[x_column].tolist()
                ],
                "y_values": [
                    float(value)
                    for value in pair[y_column].tolist()
                ]
            })

    # --------------------------------------------------
    # 4. VALEURS MANQUANTES
    # --------------------------------------------------

    missing = []

    for column in dataframe.columns:
        missing_count = int(
            dataframe[column].isna().sum()
        )

        missing_percentage = float(
            dataframe[column].isna().mean() * 100
        )

        missing.append({
            "column": column,
            "missing": missing_count,
            "percentage": round(
                missing_percentage,
                2
            )
        })

    # --------------------------------------------------
    # RESULTAT
    # --------------------------------------------------

    return {
        "dataset_id": dataset_id,
        "filename": file_path.name.removeprefix(
            f"{dataset_id}_"
        ),
        "histograms": histograms,
        "categories": categories,
        "scatter": scatter,
        "missing": missing,
    }