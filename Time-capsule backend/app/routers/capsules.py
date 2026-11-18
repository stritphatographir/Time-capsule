"""Здесь описаны HTTP-запросы к капсулам. Правила открытия и редактирования — в capsule_service."""
from datetime import date
from typing import Annotated

from fastapi import APIRouter, Path, Query, Request, Response, status

from app.schemas.capsule import (
    CapsuleCreate, CapsuleDetail, CapsuleOut, CapsuleStatus, CapsuleUpdate, NoteCount, Reflection, SignedNote,
)
from app.database import DB
from app.schemas.errors import ErrorResponse
from app.services import capsule_service

router = APIRouter(
    prefix="/capsules",
    tags=["Capsules"],
    responses={422: {"model": ErrorResponse, "description": "Request validation failed"}},
)

CapsuleId = Annotated[int, Path(ge=1, description="Capsule id")]

NOT_FOUND = {404: {"model": ErrorResponse, "description": "Capsule not found"}}


@router.get("", response_model=list[CapsuleOut], summary="List capsules")
def list_capsules(
    db: DB,
    status_filter: Annotated[
        CapsuleStatus | None, Query(alias="status", description="Filter by status")
    ] = None,
    search: Annotated[str | None, Query(min_length=1, max_length=100, description="Search in title")] = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
):
    return capsule_service.list_capsules(db, status_filter, search, limit, offset)


@router.post(
    "",
    response_model=CapsuleOut,
    status_code=status.HTTP_201_CREATED,
    summary="Create a capsule",
    responses={
        201: {"headers": {"Location": {"schema": {"type": "string"}}}},
        400: {"model": ErrorResponse, "description": "Invalid opening date"},
    },
)
def create_capsule(db: DB, payload: CapsuleCreate, request: Request, response: Response):
    capsule = capsule_service.create_capsule(db, payload)
    response.headers["Location"] = request.url_for("get_capsule", capsule_id=capsule["id"]).path
    return capsule


@router.get("/anniversaries", response_model=list[CapsuleOut], summary="On this day in past years")
def anniversaries(db: DB, day: date | None = None, limit: int = Query(20, ge=1, le=100), offset: int = Query(0, ge=0)):
    """Revisit letters first opened on this UTC month and day in an earlier year."""
    return capsule_service.anniversaries(db, day or capsule_service.utcnow().date(), limit, offset)


@router.put("/{capsule_id}/reflection", response_model=CapsuleOut, summary="Write back to your past self",
            responses={**NOT_FOUND, 403: {"model": ErrorResponse}})
def reflect(db: DB, capsule_id: CapsuleId, payload: Reflection):
    """After opening a letter, record what happened. Repeating this request replaces the reflection."""
    return capsule_service.record_reflection(db, capsule_id, payload.text)


@router.post("/{capsule_id}/notes", response_model=NoteCount, status_code=status.HTTP_201_CREATED,
             summary="Tuck a signed note into a sealed capsule",
             responses={**NOT_FOUND, 409: {"model": ErrorResponse, "description": "Deadline passed or capsule full"}})
def add_note(db: DB, capsule_id: CapsuleId, payload: SignedNote):
    """Only the count is visible until the seal is broken. Each capsule holds up to 20 notes."""
    return capsule_service.add_note(db, capsule_id, payload)


@router.get("/{capsule_id}", response_model=CapsuleDetail, summary="Get a capsule", responses=NOT_FOUND)
def get_capsule(db: DB, capsule_id: CapsuleId):
    return capsule_service.get_capsule(db, capsule_id)


@router.patch(
    "/{capsule_id}",
    response_model=CapsuleOut,
    summary="Edit a sealed capsule",
    responses={
        **NOT_FOUND,
        400: {"model": ErrorResponse, "description": "Invalid opening date"},
        409: {"model": ErrorResponse, "description": "Capsule is no longer sealed"},
    },
)
def update_capsule(db: DB, capsule_id: CapsuleId, payload: CapsuleUpdate):
    return capsule_service.update_capsule(db, capsule_id, payload)


@router.delete(
    "/{capsule_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a capsule with its recipients",
    responses=NOT_FOUND,
)
def delete_capsule(db: DB, capsule_id: CapsuleId):
    capsule_service.delete_capsule(db, capsule_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/{capsule_id}/open",
    response_model=CapsuleDetail,
    summary="Break the seal and read the letter",
    responses={
        **NOT_FOUND,
        403: {"model": ErrorResponse, "description": "The opening date has not come yet"},
        409: {"model": ErrorResponse, "description": "Already opened"},
    },
)
def open_capsule(db: DB, capsule_id: CapsuleId):
    return capsule_service.open_capsule(db, capsule_id)
