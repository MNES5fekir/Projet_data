from pathlib import Path

import pandas as pd


def load_csv(file_path: Path) -> pd.DataFrame:
    """
    Charge un fichier CSV dans un DataFrame Pandas.
    """
    return pd.read_csv(file_path)