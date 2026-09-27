from pathlib import Path


ALLOWED_EXTENSIONS = {".csv"}


def validate_file_extension(filename: str) -> bool:
    """
    Vérifie que le fichier possède une extension autorisée.
    """
    extension = Path(filename).suffix.lower()

    return extension in ALLOWED_EXTENSIONS