import asyncio
from io import BytesIO
from uuid import uuid4

import pytest
from fastapi import HTTPException, Response, UploadFile

from backend.app.api.routes.auth import Credentials, register
from backend.app.core import security
from backend.app.core.exceptions import UserAlreadyExistsError
from backend.app.services import dataset_service


@pytest.fixture
def isolated_users(tmp_path, monkeypatch):
    monkeypatch.setattr(security, "DATABASE_PATH", tmp_path / "app.sqlite3")
    security.initialize_database()


def test_user_can_authenticate_and_hold_a_session(isolated_users):
    user = security.create_user("Alice@Example.com", "un-mot-de-passe-solide")

    assert security.authenticate_user("alice@example.com", "un-mot-de-passe-solide") == user
    assert security.authenticate_user("alice@example.com", "mauvais-mot-de-passe") is None
    assert security.authenticate_user("inconnu@example.com", "un-mot-de-passe-solide") is None

    token = security.create_session(user["user_id"])
    assert security.get_session_user(token) == user
    security.revoke_session(token)
    assert security.get_session_user(token) is None


def test_duplicate_email_raises_dedicated_error(isolated_users):
    security.create_user("bob@example.com", "un-mot-de-passe-solide")

    with pytest.raises(UserAlreadyExistsError):
        security.create_user("BOB@example.com", "un-autre-mot-de-passe")


def test_short_password_is_a_bad_request_not_a_conflict(isolated_users):
    with pytest.raises(HTTPException) as error:
        register(Credentials(email="carol@example.com", password="court"), Response())

    assert error.value.status_code == 400


def test_dataset_lifecycle_is_scoped_to_its_owner(tmp_path, monkeypatch):
    monkeypatch.setattr(dataset_service, "UPLOAD_DIR", tmp_path)
    owner, stranger = str(uuid4()), str(uuid4())
    upload = UploadFile(filename="ventes.csv", file=BytesIO(b"montant,ville\n10,Paris\n20,Lyon\n"))

    created = asyncio.run(dataset_service.upload_dataset(upload, owner))
    dataset_id = created["dataset_id"]

    assert created["rows"] == 2
    assert dataset_service.list_datasets(owner)[0]["filename"] == "ventes.csv"
    assert dataset_service.list_datasets(stranger) == []
    with pytest.raises(FileNotFoundError):
        dataset_service.get_dataset_summary(dataset_id, stranger)

    charts = dataset_service.get_dataset_chart_data(dataset_id, owner)
    assert charts["categories"][0]["labels"] == ["Paris", "Lyon"]

    dataset_service.delete_dataset(dataset_id, owner)
    assert dataset_service.list_datasets(owner) == []


def test_invalid_csv_upload_is_not_stored(tmp_path, monkeypatch):
    monkeypatch.setattr(dataset_service, "UPLOAD_DIR", tmp_path)
    owner = str(uuid4())
    upload = UploadFile(filename="vide.csv", file=BytesIO(b""))

    with pytest.raises(ValueError):
        asyncio.run(dataset_service.upload_dataset(upload, owner))

    assert dataset_service.list_datasets(owner) == []
