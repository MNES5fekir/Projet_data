import os
import tempfile
from pathlib import Path
from uuid import UUID, uuid4

import numpy as np
from fastapi import UploadFile

from backend.app.ingestion.validator import validate_file_extension
from backend.app.analysis.profiler import profile_dataframe
from backend.app.ingestion.loader import load_csv


UPLOAD_DIR = Path(os.getenv("APP_UPLOAD_DIR", "data/uploads"))
MAX_UPLOAD_BYTES = 10 * 1024 * 1024


async def analyze_csv_upload(file: UploadFile) -> dict:
    if not file.filename:
        raise ValueError("Le nom du fichier est manquant.")
    if not validate_file_extension(file.filename):
        raise ValueError("Seuls les fichiers CSV sont acceptés.")

    filename = Path(file.filename).name
    content = await file.read(MAX_UPLOAD_BYTES + 1)
    if len(content) > MAX_UPLOAD_BYTES:
        await file.close()
        raise ValueError("Le fichier dépasse la limite de 10 Mo.")

    try:
        with tempfile.TemporaryDirectory(prefix="datum-analysis-") as temporary_directory:
            csv_path = Path(temporary_directory) / filename
            csv_path.write_bytes(content)
            dataframe = load_csv(csv_path)
            analysis = profile_dataframe(dataframe)
            return {
                "filename": filename,
                "file_size": len(content),
                "analysis": analysis,
                "charts": build_chart_data(dataframe),
            }
    finally:
        await file.close()


def build_chart_data(dataframe) -> dict:
    numeric_dataframe = dataframe.select_dtypes(include="number")
    categorical_dataframe = dataframe.select_dtypes(exclude="number")

    histograms = []
    for column in numeric_dataframe.columns:
        values = numeric_dataframe[column].dropna().to_numpy(dtype=float)
        if not len(values):
            continue
        bin_count = min(12, max(1, int(np.sqrt(len(values)))))
        counts, edges = np.histogram(values, bins=bin_count)
        histograms.append({
            "column": str(column),
            "labels": [
                f"{left:,.3g} – {right:,.3g}"
                for left, right in zip(edges[:-1], edges[1:])
            ],
            "values": [int(value) for value in counts],
            "mean": float(np.mean(values)),
            "median": float(np.median(values)),
        })

    categories = []
    for column in categorical_dataframe.columns:
        counts = categorical_dataframe[column].dropna().astype(str).value_counts().head(8)
        if counts.empty:
            continue
        categories.append({
            "column": str(column),
            "labels": [str(value) for value in counts.index],
            "values": [int(value) for value in counts.values],
        })

    scatter = []
    numeric_columns = list(numeric_dataframe.columns)
    for index, x_column in enumerate(numeric_columns):
        for y_column in numeric_columns[index + 1:]:
            pair = dataframe[[x_column, y_column]].dropna()
            if len(pair) > 200:
                pair = pair.sample(n=200, random_state=0)
            scatter.append({
                "x_column": str(x_column),
                "y_column": str(y_column),
                "points": [
                    {"x": float(x), "y": float(y)}
                    for x, y in pair[[x_column, y_column]].itertuples(index=False, name=None)
                ],
            })
            if len(scatter) >= 6:
                break
        if len(scatter) >= 6:
            break

    return {"histograms": histograms, "categories": categories, "scatter": scatter}


def _user_upload_dir(user_id: str) -> Path:
    try:
        normalized_user_id = str(UUID(user_id))
    except ValueError as exc:
        raise FileNotFoundError("Dataset not found.") from exc
    return UPLOAD_DIR / normalized_user_id


def find_dataset(dataset_id: str, user_id: str) -> Path | None:
    """
    Recherche le fichier correspondant à un dataset_id.
    """

    try:
        normalized_dataset_id = str(UUID(dataset_id))
    except ValueError:
        return None
    matching_files = list(_user_upload_dir(user_id).glob(f"{normalized_dataset_id}_*"))

    if not matching_files:
        return None

    return matching_files[0]


def get_dataset_summary(dataset_id: str, user_id: str) -> dict:
    """
    Charge et analyse un dataset.
    """

    file_path = find_dataset(dataset_id, user_id)

    if file_path is None:
        raise FileNotFoundError("Dataset not found.")

    dataframe = load_csv(file_path)

    return {
        "dataset_id": dataset_id,
        "filename": file_path.name.removeprefix(f"{dataset_id}_"),
        "analysis": profile_dataframe(dataframe)
    }


def list_datasets(user_id: str) -> list[dict]:
    """
    Retourne tous les datasets disponibles.
    """

    datasets = []

    user_dir = _user_upload_dir(user_id)
    if not user_dir.exists():
        return datasets

    for file_path in user_dir.iterdir():
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


def delete_dataset(dataset_id: str, user_id: str) -> dict:
    """
    Supprime un dataset.
    """

    file_path = find_dataset(dataset_id, user_id)

    if file_path is None:
        raise FileNotFoundError("Dataset not found.")

    filename = file_path.name.removeprefix(f"{dataset_id}_")

    file_path.unlink()

    return {
        "dataset_id": dataset_id,
        "filename": filename,
        "deleted": True
    }



async def upload_dataset(file: UploadFile, user_id: str) -> dict:
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

    user_dir = _user_upload_dir(user_id)
    user_dir.mkdir(parents=True, exist_ok=True)
    filename = f"{dataset_id}_{original_filename}"
    file_path = user_dir / filename

    content = await file.read(MAX_UPLOAD_BYTES + 1)
    if len(content) > MAX_UPLOAD_BYTES:
        await file.close()
        raise ValueError("Le fichier dépasse la limite de 10 Mo.")

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


def get_dataset_chart_data(dataset_id: str, user_id: str) -> dict:
    file_path = find_dataset(dataset_id, user_id)

    if file_path is None:
        raise FileNotFoundError("Dataset not found.")

    dataframe = load_csv(file_path)

    # Nombre maximum de points envoyés au frontend
    MAX_POINTS = 200

    numeric_dataframe = dataframe.select_dtypes(
        include="number"
    )

    histograms = []

    for column in numeric_dataframe.columns:
        series = (
            numeric_dataframe[column]
            .dropna()
        )

        if len(series) > MAX_POINTS:
            step = max(1, len(series) // MAX_POINTS)
            series = series.iloc[::step].head(MAX_POINTS)

        histograms.append({
            "column": column,
            "values": [
                float(value)
                for value in series.tolist()
            ]
        })

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

    scatter = []

    numeric_columns = list(
        numeric_dataframe.columns
    )

    for index, x_column in enumerate(numeric_columns):
        for y_column in numeric_columns[index + 1:]:
            pair = dataframe[
                [x_column, y_column]
            ].dropna()

            if len(pair) > MAX_POINTS:
                step = max(1, len(pair) // MAX_POINTS)
                pair = pair.iloc[::step].head(MAX_POINTS)

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


def _format_number(value: float) -> str:
    return f"{value:,.2f}".replace(",", " ").replace(".", ",")


def answer_dataset_question(dataset_id: str, user_id: str, question: str) -> dict:
    file_path = find_dataset(dataset_id, user_id)
    if file_path is None:
        raise FileNotFoundError("Dataset not found.")

    dataframe = load_csv(file_path)
    normalized_question = question.casefold()
    numeric = dataframe.select_dtypes(include="number")
    formatted_rows = f"{len(dataframe):,}".replace(",", " ")
    matching_column = next(
        (column for column in dataframe.columns if str(column).casefold() in normalized_question),
        None,
    )

    if any(word in normalized_question for word in ("colonne", "champ", "variables")):
        answer = "Les colonnes de ce fichier sont : " + ", ".join(map(str, dataframe.columns)) + "."
    elif any(word in normalized_question for word in ("ligne", "enregistrement", "observation")):
        answer = f"Ce jeu de données contient {formatted_rows} lignes et {len(dataframe.columns)} colonnes."
    elif any(word in normalized_question for word in ("manquant", "vide", "absent", "null")):
        missing = dataframe.isna().sum().sort_values(ascending=False)
        nonzero = missing[missing > 0]
        if nonzero.empty:
            answer = "Aucune valeur manquante n’a été détectée dans ce jeu de données."
        else:
            details = ", ".join(f"{column} : {int(count)}" for column, count in nonzero.items())
            answer = f"Valeurs manquantes par colonne : {details}."
    elif matching_column is not None and matching_column in numeric.columns:
        values = numeric[matching_column].dropna()
        if values.empty:
            answer = f"La colonne « {matching_column} » ne contient pas de valeur numérique exploitable."
        elif any(word in normalized_question for word in ("moyenne", "average", "mean")):
            answer = f"La moyenne de « {matching_column} » est {_format_number(values.mean())}."
        elif any(word in normalized_question for word in ("médiane", "median")):
            answer = f"La médiane de « {matching_column} » est {_format_number(values.median())}."
        elif any(word in normalized_question for word in ("maximum", "max", "plus élevé", "plus grande")):
            answer = f"La valeur maximale de « {matching_column} » est {_format_number(values.max())}."
        elif any(word in normalized_question for word in ("minimum", "min", "plus faible", "plus petite")):
            answer = f"La valeur minimale de « {matching_column} » est {_format_number(values.min())}."
        else:
            answer = (
                f"Pour « {matching_column} » : moyenne {_format_number(values.mean())}, "
                f"médiane {_format_number(values.median())}, minimum {_format_number(values.min())} "
                f"et maximum {_format_number(values.max())}."
            )
    elif matching_column is not None:
        counts = dataframe[matching_column].dropna().astype(str).value_counts().head(5)
        if counts.empty:
            answer = f"La colonne « {matching_column} » ne contient aucune valeur renseignée."
        else:
            top_values = ", ".join(f"{value} ({count})" for value, count in counts.items())
            answer = f"Valeurs les plus fréquentes de « {matching_column} » : {top_values}."
    else:
        answer = (
            f"J’ai analysé {len(dataframe):,} lignes et {len(dataframe.columns)} colonnes, "
            f"dont {len(numeric.columns)} numériques. Posez une question sur les colonnes, "
            "les valeurs manquantes, ou une statistique en citant le nom d’une colonne."
        )

    return {"answer": answer, "agent": "Analyse locale", "dataset_id": dataset_id}