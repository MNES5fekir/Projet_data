import math

import numpy as np
import pandas as pd


def _finite(value) -> float | None:
    """Convertit en float JSON-compatible : NaN et infini deviennent None."""
    if value is None:
        return None
    value = float(value)
    return value if math.isfinite(value) else None


def numeric_frame(dataframe: pd.DataFrame) -> pd.DataFrame:
    """Colonnes numériques, avec les infinis traités comme des valeurs manquantes."""
    return dataframe.select_dtypes(include="number").replace([np.inf, -np.inf], np.nan)


def detect_outliers(numeric_dataframe: pd.DataFrame) -> dict:
    q1 = numeric_dataframe.quantile(0.25)
    q3 = numeric_dataframe.quantile(0.75)
    iqr = q3 - q1
    lower_bounds = q1 - 1.5 * iqr
    upper_bounds = q3 + 1.5 * iqr
    counts = numeric_dataframe.lt(lower_bounds).sum() + numeric_dataframe.gt(upper_bounds).sum()
    non_missing = numeric_dataframe.count()

    outliers = {}
    for column in numeric_dataframe.columns:
        total = int(non_missing[column])
        count = int(counts[column]) if total else 0
        outliers[column] = {
            "count": count,
            "percentage": round(count / total * 100, 2) if total else 0.0,
            "lower_bound": _finite(lower_bounds[column]) if total else None,
            "upper_bound": _finite(upper_bounds[column]) if total else None,
        }
    return outliers


def _correlations(numeric_dataframe: pd.DataFrame) -> list[dict]:
    if len(numeric_dataframe.columns) < 2:
        return []

    matrix = numeric_dataframe.corr()
    columns = list(matrix.columns)
    rows, cols = np.triu_indices(len(columns), k=1)
    values = matrix.to_numpy()[rows, cols]

    correlations = [
        {"column": columns[i], "other_column": columns[j], "value": round(float(value), 4)}
        for i, j, value in zip(rows, cols, values)
        if math.isfinite(value)
    ]
    correlations.sort(key=lambda item: abs(item["value"]), reverse=True)
    return correlations


def profile_dataframe(dataframe: pd.DataFrame) -> dict:
    numeric_dataframe = numeric_frame(dataframe)

    # Statistiques numériques
    statistics = {}
    if len(numeric_dataframe.columns):
        aggregated = numeric_dataframe.agg(["mean", "median", "min", "max", "std", "count"])
        for column in numeric_dataframe.columns:
            if not aggregated.at["count", column]:
                continue
            statistics[column] = {
                name: _finite(aggregated.at[name, column])
                for name in ("mean", "median", "min", "max", "std")
            }

    # Informations colonnes et valeurs manquantes
    missing_counts = dataframe.isna().sum()
    unique_counts = dataframe.nunique()
    row_count = len(dataframe)
    missing_values = {column: int(missing_counts[column]) for column in dataframe.columns}
    columns = [
        {
            "name": column,
            "type": str(dataframe[column].dtype),
            "unique_values": int(unique_counts[column]),
            "missing_values": missing_values[column],
            "missing_percentage": round(missing_values[column] / row_count * 100, 2) if row_count else 0.0,
        }
        for column in dataframe.columns
    ]

    overview = {
        "rows": row_count,
        "columns": len(dataframe.columns),
        "numeric_columns": len(numeric_dataframe.columns),
        "text_columns": len(dataframe.columns) - len(numeric_dataframe.columns),
        "missing_values": sum(missing_values.values()),
        "duplicates": int(dataframe.duplicated().sum()),
    }

    return {
        "overview": overview,
        "columns": columns,
        "statistics": statistics,
        "correlations": _correlations(numeric_dataframe),
        "missing_values": missing_values,
        "outliers": detect_outliers(numeric_dataframe),
    }
