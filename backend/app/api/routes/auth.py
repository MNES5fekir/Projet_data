import re

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from pydantic import BaseModel, Field, field_validator

from backend.app.core.security import (
    COOKIE_SECURE,
    SESSION_COOKIE,
    SESSION_TTL,
    authenticate_user,
    create_session,
    create_user,
    get_current_user,
    revoke_session,
)


router = APIRouter(prefix="/auth", tags=["authentication"])


class Credentials(BaseModel):
    email: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=1, max_length=256)

    @field_validator("email")
    @classmethod
    def validate_email(cls, email: str) -> str:
        if not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", email.strip()):
            raise ValueError("Veuillez saisir une adresse e-mail valide.")
        return email.strip()


def _set_session(response: Response, user: dict) -> dict:
    token = create_session(user["user_id"])
    response.set_cookie(
        key=SESSION_COOKIE,
        value=token,
        max_age=SESSION_TTL,
        httponly=True,
        secure=COOKIE_SECURE,
        samesite="lax",
        path="/",
    )
    return user


@router.post("/register", status_code=status.HTTP_201_CREATED)
def register(credentials: Credentials, response: Response):
    try:
        user = create_user(credentials.email, credentials.password)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    return _set_session(response, user)


@router.post("/login")
def login(credentials: Credentials, response: Response):
    user = authenticate_user(credentials.email, credentials.password)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Adresse e-mail ou mot de passe incorrect.",
        )
    return _set_session(response, user)


@router.get("/me")
def current_user(user: dict = Depends(get_current_user)):
    return user


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(request: Request, response: Response):
    revoke_session(request.cookies.get(SESSION_COOKIE))
    response.delete_cookie(
        key=SESSION_COOKIE,
        httponly=True,
        secure=COOKIE_SECURE,
        samesite="lax",
        path="/",
    )