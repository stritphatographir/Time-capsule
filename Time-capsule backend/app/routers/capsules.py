"""Capsule routes. Only handles request reception and service calls; no business logic here."""
from typing import Annotated

from fastapi import APIRouter, Path, Query, Request, Response, status

from app.schemas.capsule import CapsuleCreate, CapsuleOut, CapsuleStatus, CapsuleUpdate
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
    status_filter: Annotated[
        CapsuleStatus | None, Query(alias="status", description="Filter by status")
    ] = None,
    search: Annotated[str | None, Query(min_length=1, max_length=100, description="Search in title")] = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
):
    return capsule_service.list_capsules(status_filter, search, limit, offset)


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
def create_capsule(payload: CapsuleCreate, request: Request, response: Response):
    capsule = capsule_service.create_capsule(payload)
    response.headers["Location"] = request.url_for("get_capsule", capsule_id=capsule["id"]).path
    return capsule


@router.get("/{capsule_id}", response_model=CapsuleOut, summary="Get a capsule", responses=NOT_FOUND)
def get_capsule(capsule_id: CapsuleId):
    return capsule_service.get_capsule(capsule_id)


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
def update_capsule(capsule_id: CapsuleId, payload: CapsuleUpdate):
    return capsule_service.update_capsule(capsule_id, payload)


@router.delete(
    "/{capsule_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a capsule with its recipients",
    responses=NOT_FOUND,
)
def delete_capsule(capsule_id: CapsuleId):
    capsule_service.delete_capsule(capsule_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/{capsule_id}/open",
    response_model=CapsuleOut,
    summary="Break the seal and read the letter",
    responses={
        **NOT_FOUND,
        403: {"model": ErrorResponse, "description": "The opening date has not come yet"},
        409: {"model": ErrorResponse, "description": "Already opened"},
    },
)
def open_capsule(capsule_id: CapsuleId):
    return capsule_service.open_capsule(capsule_id)
