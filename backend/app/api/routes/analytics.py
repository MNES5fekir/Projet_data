import hmac
import os
import secrets

from fastapi import APIRouter, Header, HTTPException, Request, Response, status
from pydantic import BaseModel, Field

from backend.app.core.config import COOKIE_SECURE
from backend.app.services.analytics_service import (
    get_analytics_summary,
    record_event,
    revoke_visitor,
)


router = APIRouter(prefix="/analytics", tags=["analytics"])
CONSENT_COOKIE = "dataclair_consent"
VISITOR_COOKIE = "dataclair_visitor"
COOKIE_MAX_AGE = 60 * 60 * 24 * 180


class ConsentRequest(BaseModel):
    accepted: bool


class EventRequest(BaseModel):
    event: str = Field(min_length=1, max_length=40)
    section: str | None = Field(default=None, max_length=30)


def _set_cookie(response: Response, name: str, value: str, max_age: int):
    response.set_cookie(
        key=name,
        value=value,
        max_age=max_age,
        httponly=True,
        secure=COOKIE_SECURE,
        samesite="lax",
        path="/",
    )


@router.get("/consent")
def get_consent(request: Request):
    return {"choice": request.cookies.get(CONSENT_COOKIE, "unknown")}


@router.post("/consent")
def save_consent(consent: ConsentRequest, request: Request, response: Response):
    if consent.accepted:
        visitor_id = request.cookies.get(VISITOR_COOKIE) or secrets.token_urlsafe(24)
        _set_cookie(response, CONSENT_COOKIE, "accepted", COOKIE_MAX_AGE)
        _set_cookie(response, VISITOR_COOKIE, visitor_id, COOKIE_MAX_AGE)
        return {"choice": "accepted"}

    revoke_visitor(request.cookies.get(VISITOR_COOKIE))
    response.delete_cookie(VISITOR_COOKIE, httponly=True, secure=COOKIE_SECURE, samesite="lax", path="/")
    _set_cookie(response, CONSENT_COOKIE, "rejected", COOKIE_MAX_AGE)
    return {"choice": "rejected"}


@router.post("/events", status_code=status.HTTP_202_ACCEPTED)
def create_event(event: EventRequest, request: Request):
    if request.cookies.get(CONSENT_COOKIE) != "accepted":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Le suivi n’est pas autorisé.")
    visitor_id = request.cookies.get(VISITOR_COOKIE)
    if not visitor_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Aucun identifiant de mesure consenti.")
    try:
        record_event(visitor_id, event.event, event.section)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail=str(exc)) from exc
    return {"recorded": True}


@router.get("/summary")
def analytics_summary(authorization: str | None = Header(default=None)):
    admin_token = os.getenv("ANALYTICS_ADMIN_TOKEN")
    if not admin_token:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="La consultation des statistiques n’est pas configurée.")
    expected = f"Bearer {admin_token}"
    if not authorization or not hmac.compare_digest(authorization, expected):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Clé administrateur invalide.")
    return get_analytics_summary()