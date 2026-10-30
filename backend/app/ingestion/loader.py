import csv
from io import StringIO
from pathlib import Path

import pandas as pd


ENCODINGS = ("utf-8-sig", "cp1252", "latin-1")
DELIMITERS = ",;\t|"
SNIFF_SAMPLE_SIZE = 64 * 1024


def _decode(content: bytes) -> str:
    for encoding in ENCODINGS:
        try:
            return content.decode(encoding)
        except UnicodeDecodeError:
            continue
    raise ValueError("L’encodage du fichier n’est pas reconnu.")


def _detect_delimiter(text: str) -> str:
    sample = text[:SNIFF_SAMPLE_SIZE]
    try:
        return csv.Sniffer().sniff(sample, delimiters=DELIMITERS).delimiter
    except csv.Error:
        first_line = sample.split("\n", 1)[0]
        return max(DELIMITERS, key=first_line.count) if any(d in first_line for d in DELIMITERS) else ","


def parse_csv(content: bytes) -> pd.DataFrame:
    """
    Charge un CSV en mémoire en détectant l’encodage et le séparateur.
    Les exports Excel français (« ; » et virgule décimale) sont pris en charge.
    """
    if not content.strip():
        raise ValueError("Le fichier est vide.")

    text = _decode(content)
    delimiter = _detect_delimiter(text)
    decimal = "," if delimiter == ";" else "."
    try:
        dataframe = pd.read_csv(StringIO(text), sep=delimiter, decimal=decimal)
    except pd.errors.EmptyDataError as exc:
        raise ValueError("Le fichier ne contient aucune donnée.") from exc
    except pd.errors.ParserError as exc:
        raise ValueError("Le fichier CSV est mal formé.") from exc

    dataframe.columns = [str(column) for column in dataframe.columns]
    return dataframe


def load_csv(file_path: Path) -> pd.DataFrame:
    """
    Charge un fichier CSV dans un DataFrame Pandas.
    """
    return parse_csv(Path(file_path).read_bytes())
