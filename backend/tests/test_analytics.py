import sqlite3

import pytest
from fastapi import HTTPException, Request

from backend.app.api.routes.analytics import EventRequest, analytics_summary, create_event
from backend.app.services import analytics_service


@pytest.fixture
def isolated_analytics(tmp_path, monkeypatch):
    monkeypatch.setattr(analytics_service, "DATABASE_PATH", tmp_path / "analytics.sqlite3")
    analytics_service.initialize_database()


def test_summary_aggregates_events_without_exposing_visitors(isolated_analytics):
    analytics_service.record_event("visitor-one", "page_view", "home")
    analytics_service.record_event("visitor-one", "section_view", "correlations")
    analytics_service.record_event("visitor-one", "analysis_succeeded", "upload")
    analytics_service.record_event("visitor-two", "page_view", "home")

    summary = analytics_service.get_analytics_summary()

    assert summary["visitors_total"] == 2
    assert summary["views_total"] == 3
    assert summary["events_total"] == 4
    assert summary["sections"][0] == {"section": "home", "views": 2, "visitors": 2}
    assert summary["actions"] == [
        {"event_name": "analysis_succeeded", "count": 1, "visitors": 1}
    ]
    assert "visitor_hash" not in str(summary)


def test_revoking_consent_deletes_visitor_history(isolated_analytics):
    analytics_service.record_event("visitor-one", "page_view", "home")
    analytics_service.revoke_visitor("visitor-one")

    assert analytics_service.get_analytics_summary()["events_total"] == 0


def test_unknown_analytics_events_are_rejected(isolated_analytics):
    with pytest.raises(ValueError):
        analytics_service.record_event("visitor-one", "collect_email", "home")


def test_summary_purges_events_past_retention(isolated_analytics, monkeypatch):
    analytics_service.record_event("visitor-one", "page_view", "home")
    with sqlite3.connect(analytics_service.DATABASE_PATH) as connection:
        connection.execute("UPDATE analytics_events SET created_at = 0")
    monkeypatch.setattr(analytics_service, "RETENTION_SECONDS", 1)

    assert analytics_service.get_analytics_summary()["events_total"] == 0


def test_event_endpoint_requires_consent(isolated_analytics):
    request = Request({"type": "http", "headers": []})

    with pytest.raises(HTTPException) as error:
        create_event(EventRequest(event="page_view", section="home"), request)

    assert error.value.status_code == 403


def test_admin_summary_requires_configured_token(isolated_analytics, monkeypatch):
    monkeypatch.setenv("ANALYTICS_ADMIN_TOKEN", "local-test-token")
    assert analytics_summary("Bearer local-test-token")["visitors_total"] == 0

    with pytest.raises(HTTPException) as error:
        analytics_summary("Bearer wrong-token")

    assert error.value.status_code == 401