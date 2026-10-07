import pandas as pd


def detect_outliers(dataframe: pd.DataFrame) -> dict:
    numeric_dataframe = dataframe.select_dtypes(include="number")

    outliers = {}

    for column in numeric_dataframe.columns:
        series = numeric_dataframe[column].dropna()

        if series.empty:
            outliers[column] = {
                "count": 0,
                "percentage": 0.0,
                "lower_bound": None,
                "upper_bound": None,
            }
            continue

        q1 = series.quantile(0.25)
        q3 = series.quantile(0.75)
        iqr = q3 - q1

        lower_bound = q1 - 1.5 * iqr
        upper_bound = q3 + 1.5 * iqr

        mask = (series < lower_bound) | (series > upper_bound)

        count = int(mask.sum())
        percentage = float((count / len(series)) * 100)

        outliers[column] = {
            "count": count,
            "percentage": round(percentage, 2),
            "lower_bound": float(lower_bound),
            "upper_bound": float(upper_bound),
        }

    return outliers


def profile_dataframe(dataframe: pd.DataFrame) -> dict:
    numeric_dataframe = dataframe.select_dtypes(include="number")

    # -------------------------
    # Statistiques numériques
    # -------------------------

    statistics = {}

    for column in numeric_dataframe.columns:
        series = dataframe[column].dropna()

        if series.empty:
            continue

        statistics[column] = {
            "mean": float(series.mean()),
            "median": float(series.median()),
            "min": float(series.min()),
            "max": float(series.max()),
            "std": float(series.std()),
        }

    # -------------------------
    # Informations colonnes
    # -------------------------

    columns = []

    for column in dataframe.columns:
        series = dataframe[column]

        columns.append({
            "name": column,
            "type": str(series.dtype),
            "unique_values": int(series.nunique()),
            "missing_values": int(series.isna().sum()),
            "missing_percentage": round(
                float(series.isna().mean() * 100),
                2
            ),
        })

    # -------------------------
    # Corrélations
    # -------------------------

    correlations = []

    if len(numeric_dataframe.columns) >= 2:
        correlation_dataframe = numeric_dataframe.corr()
        numeric_columns = list(correlation_dataframe.columns)
        for index, column in enumerate(numeric_columns):
            for other_column in numeric_columns[index + 1:]:
                value = correlation_dataframe.loc[column, other_column]
                if pd.isna(value):
                    continue
                correlations.append({
                    "column": str(column),
                    "other_column": str(other_column),
                    "value": round(float(value), 4),
                })
        correlations.sort(key=lambda item: abs(item["value"]), reverse=True)

    # -------------------------
    # Valeurs manquantes
    # -------------------------

    missing_values = {
        column: int(dataframe[column].isna().sum())
        for column in dataframe.columns
    }

    # -------------------------
    # Doublons
    # -------------------------

    duplicates = int(dataframe.duplicated().sum())

    # -------------------------
    # Outliers
    # -------------------------

    outliers = detect_outliers(dataframe)

    # -------------------------
    # Vue globale
    # -------------------------

    overview = {
        "rows": len(dataframe),
        "columns": len(dataframe.columns),
        "numeric_columns": len(numeric_dataframe.columns),
        "text_columns": len(dataframe.columns) - len(numeric_dataframe.columns),
        "missing_values": sum(missing_values.values()),
        "duplicates": duplicates,
    }

    return {
        "overview": overview,
        "columns": columns,
        "statistics": statistics,
        "correlations": correlations,
        "missing_values": missing_values,
        "outliers": outliers,
    }