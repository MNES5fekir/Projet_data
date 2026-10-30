import asyncio
from io import BytesIO

import pytest
from fastapi import UploadFile

from backend.app.services import dataset_service


def test_anonymous_csv_analysis_is_temporary(tmp_path, monkeypatch):
    upload_directory = tmp_path / "uploads"
    monkeypatch.setattr(dataset_service, "UPLOAD_DIR", upload_directory)
    upload = UploadFile(
        filename="ventes.csv",
        file=BytesIO(
            b"montant,quantite,ville\n10,1,Paris\n20,2,Lyon\n30,3,Paris\n"
        ),
    )

    result = asyncio.run(dataset_service.analyze_csv_upload(upload))

    assert result["analysis"]["overview"]["rows"] == 3
    assert result["analysis"]["correlations"] == [
        {"column": "montant", "other_column": "quantite", "value": 1.0}
    ]
    assert result["charts"]["histograms"]
    assert result["charts"]["categories"][0]["labels"] == ["Paris", "Lyon"]
    assert result["charts"]["scatter"][0]["points"]
    assert not upload_directory.exists()


def test_anonymous_analysis_rejects_non_csv():
    upload = UploadFile(filename="notes.txt", file=BytesIO(b"not a csv"))

    with pytest.raises(ValueError, match="CSV"):
        asyncio.run(dataset_service.analyze_csv_upload(upload))


def test_anonymous_analysis_rejects_oversized_file(monkeypatch):
    monkeypatch.setattr(dataset_service, "MAX_UPLOAD_BYTES", 8)
    upload = UploadFile(filename="large.csv", file=BytesIO(b"a,b\n1,2\n3,4\n"))

    with pytest.raises(ValueError, match="10 Mo"):
        asyncio.run(dataset_service.analyze_csv_upload(upload))

def test_concurrent_analyses_are_capped(monkeypatch):
    import threading
    import time

    import anyio

    monkeypatch.setattr(dataset_service, "_analysis_limiter", anyio.CapacityLimiter(2))
    active, peak, lock = 0, 0, threading.Lock()

    def slow_analysis(filename, content):
        nonlocal active, peak
        with lock:
            active += 1
            peak = max(peak, active)
        time.sleep(0.05)
        with lock:
            active -= 1
        return {}

    monkeypatch.setattr(dataset_service, "_analyze_content", slow_analysis)

    async def run_all():
        uploads = [UploadFile(filename=f"f{i}.csv", file=BytesIO(b"a\n1\n")) for i in range(6)]
        await asyncio.gather(*(dataset_service.analyze_csv_upload(upload) for upload in uploads))

    asyncio.run(run_all())
    assert peak == 2


def test_api_docs_are_disabled_by_default():
    from backend.app.main import app

    assert app.openapi_url is None
    assert app.docs_url is None
    assert app.redoc_url is None
