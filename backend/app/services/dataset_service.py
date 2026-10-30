from pathlib import Path
from uuid import UUID, uuid4

import anyio
import numpy as np
import pandas as pd
from fastapi import UploadFile

from backend.app.analysis.profiler import numeric_frame, profile_dataframe
from backend.app.core.config import MAX_CONCURRENT_ANALYSES, MAX_UPLOAD_BYTES, UPLOAD_DIR
from backend.app.ingestion.loader import load_csv, parse_csv
from backend.app.ingestion.validator import validate_file_extension


MAX_SCATTER_PAIRS = 6
MAX_CHART_POINTS = 200

# Les analyses en attente patientent ici au lieu de toutes charger leur CSV en même temps.
_analysis_limiter = anyio.CapacityLimiter(MAX_CONCURRENT_ANALYSES)


async def _run_analysis(function, *args):
    return await anyio.to_thread.run_sync(function, *args, limiter=_analysis_limiter)


async def _read_csv_upload(file: UploadFile) -> tuple[str, bytes]:
    """Valide l’upload et retourne (nom de fichier assaini, contenu)."""
    try:
        if not file.filename:
            raise ValueError("Le nom du fichier est manquant.")
        if not validate_file_extension(file.filename):
            raise ValueError("Seuls les fichiers CSV sont acceptés.")

        content = await file.read(MAX_UPLOAD_BYTES + 1)
        if len(content) > MAX_UPLOAD_BYTES:
            raise ValueError("Le fichier dépasse la limite de 10 Mo.")
        return Path(file.filename).name, content
    finally:
        await file.close()


def _analyze_content(filename: str, content: bytes) -> dict:
    dataframe = parse_csv(content)
    return {
        "filename": filename,
        "file_size": len(content),
        "analysis": profile_dataframe(dataframe),
        "charts": build_chart_data(dataframe),
    }


async def analyze_csv_upload(file: UploadFile) -> dict:
    """
    Analyse un CSV entièrement en mémoire : rien n’est écrit sur disque.
    Le calcul pandas tourne dans un thread pour ne pas bloquer le serveur.
    """
    filename, content = await _read_csv_upload(file)
    return await _run_analysis(_analyze_content, filename, content)


def _numeric_pairs(numeric_columns: list[str], limit: int | None = None):
    count = 0
    for index, x_column in enumerate(numeric_columns):
        for y_column in numeric_columns[index + 1:]:
            if limit is not None and count >= limit:
                return
            count += 1
            yield x_column, y_column


def _sample(frame: pd.DataFrame, size: int = MAX_CHART_POINTS) -> pd.DataFrame:
    return frame.sample(n=size, random_state=0) if len(frame) > size else frame


def _top_categories(dataframe: pd.DataFrame, limit: int) -> list[dict]:
    categories = []
    for column in dataframe.select_dtypes(exclude="number").columns:
        counts = dataframe[column].dropna().astype(str).value_counts().head(limit)
        if counts.empty:
            continue
        categories.append({
            "column": column,
            "labels": counts.index.tolist(),
            "values": [int(value) for value in counts.to_numpy()],
        })
    return categories


def build_chart_data(dataframe: pd.DataFrame) -> dict:
    numeric_dataframe = numeric_frame(dataframe)

    histograms = []
    for column in numeric_dataframe.columns:
        values = numeric_dataframe[column].dropna().to_numpy(dtype=float)
        if not len(values):
            continue
        bin_count = min(12, max(1, int(np.sqrt(len(values)))))
        counts, edges = np.histogram(values, bins=bin_count)
        histograms.append({
            "column": column,
            "labels": [
                f"{left:,.3g} – {right:,.3g}"
                for left, right in zip(edges[:-1], edges[1:])
            ],
            "values": counts.tolist(),
            "mean": float(values.mean()),
            "median": float(np.median(values)),
        })

    scatter = []
    for x_column, y_column in _numeric_pairs(list(numeric_dataframe.columns), MAX_SCATTER_PAIRS):
        pair = _sample(numeric_dataframe[[x_column, y_column]].dropna())
        scatter.append({
            "x_column": x_column,
            "y_column": y_column,
            "points": [{"x": x, "y": y} for x, y in pair.to_numpy(dtype=float).tolist()],
        })

    return {
        "histograms": histograms,
        "categories": _top_categories(dataframe, 8),
        "scatter": scatter,
    }


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
    return next(_user_upload_dir(user_id).glob(f"{normalized_dataset_id}_*"), None)


def _require_dataset(dataset_id: str, user_id: str) -> Path:
    file_path = find_dataset(dataset_id, user_id)
    if file_path is None:
        raise FileNotFoundError("Dataset not found.")
    return file_path


def _original_filename(file_path: Path, dataset_id: str) -> str:
    return file_path.name.removeprefix(f"{dataset_id}_")


def get_dataset_summary(dataset_id: str, user_id: str) -> dict:
    """
    Charge et analyse un dataset.
    """
    file_path = _require_dataset(dataset_id, user_id)
    return {
        "dataset_id": dataset_id,
        "filename": _original_filename(file_path, dataset_id),
        "analysis": profile_dataframe(load_csv(file_path)),
    }


def list_datasets(user_id: str) -> list[dict]:
    """
    Retourne tous les datasets disponibles.
    """
    user_dir = _user_upload_dir(user_id)
    if not user_dir.exists():
        return []

    datasets = []
    for file_path in user_dir.iterdir():
        if not file_path.is_file() or "_" not in file_path.name:
            continue
        dataset_id, original_filename = file_path.name.split("_", 1)
        datasets.append({
            "dataset_id": dataset_id,
            "filename": original_filename,
            "size_bytes": file_path.stat().st_size,
        })
    return datasets


def delete_dataset(dataset_id: str, user_id: str) -> dict:
    """
    Supprime un dataset.
    """
    file_path = _require_dataset(dataset_id, user_id)
    file_path.unlink()
    return {
        "dataset_id": dataset_id,
        "filename": _original_filename(file_path, dataset_id),
        "deleted": True,
    }


def _save_and_analyze(file_path: Path, content: bytes) -> pd.DataFrame:
    dataframe = parse_csv(content)
    file_path.write_bytes(content)
    return dataframe


async def upload_dataset(file: UploadFile, user_id: str) -> dict:
    """
    Enregistre un fichier CSV et retourne son analyse.
    """
    original_filename, content = await _read_csv_upload(file)

    dataset_id = str(uuid4())
    user_dir = _user_upload_dir(user_id)
    user_dir.mkdir(parents=True, exist_ok=True)
    file_path = user_dir / f"{dataset_id}_{original_filename}"

    # Le CSV est validé avant écriture : un fichier invalide n’est jamais stocké.
    dataframe = await _run_analysis(_save_and_analyze, file_path, content)
    analysis = await _run_analysis(profile_dataframe, dataframe)
    return {
        "dataset_id": dataset_id,
        "filename": original_filename,
        "rows": len(dataframe),
        "columns": len(dataframe.columns),
        "analysis": analysis,
    }


def get_dataset_chart_data(dataset_id: str, user_id: str) -> dict:
    file_path = _require_dataset(dataset_id, user_id)
    dataframe = load_csv(file_path)
    numeric_dataframe = numeric_frame(dataframe)

    histograms = [
        {
            "column": column,
            "values": _sample(numeric_dataframe[[column]].dropna())[column].tolist(),
        }
        for column in numeric_dataframe.columns
    ]

    scatter = []
    for x_column, y_column in _numeric_pairs(list(numeric_dataframe.columns)):
        pair = _sample(numeric_dataframe[[x_column, y_column]].dropna())
        scatter.append({
            "x_column": x_column,
            "y_column": y_column,
            "x_values": pair[x_column].tolist(),
            "y_values": pair[y_column].tolist(),
        })

    row_count = len(dataframe)
    missing_counts = dataframe.isna().sum()
    missing = [
        {
            "column": column,
            "missing": int(missing_counts[column]),
            "percentage": round(int(missing_counts[column]) / row_count * 100, 2) if row_count else 0.0,
        }
        for column in dataframe.columns
    ]

    return {
        "dataset_id": dataset_id,
        "filename": _original_filename(file_path, dataset_id),
        "histograms": histograms,
        "categories": _top_categories(dataframe, 20),
        "scatter": scatter,
        "missing": missing,
    }


def _format_number(value: float) -> str:
    return f"{value:,.2f}".replace(",", " ").replace(".", ",")


def answer_dataset_question(dataset_id: str, user_id: str, question: str) -> dict:
    dataframe = load_csv(_require_dataset(dataset_id, user_id))
    normalized_question = question.casefold()
    numeric = numeric_frame(dataframe)
    formatted_rows = f"{len(dataframe):,}".replace(",", " ")
    matching_column = next(
        (column for column in dataframe.columns if column.casefold() in normalized_question),
        None,
    )

    if any(word in normalized_question for word in ("colonne", "champ", "variables")):
        answer = "Les colonnes de ce fichier sont : " + ", ".join(dataframe.columns) + "."
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
            f"J’ai analysé {formatted_rows} lignes et {len(dataframe.columns)} colonnes, "
            f"dont {len(numeric.columns)} numériques. Posez une question sur les colonnes, "
            "les valeurs manquantes, ou une statistique en citant le nom d’une colonne."
        )

    return {"answer": answer, "agent": "Analyse locale", "dataset_id": dataset_id}
