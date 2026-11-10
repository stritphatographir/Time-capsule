"""Recipient routes. A recipient always belongs to a capsule."""
from typing import Annotated

from fastapi import APIRouter, Path, Response, status

from app.schemas.errors import ErrorResponse
from app.schemas.recipient import RecipientCreate, RecipientOut
from app.services import recipient_service

router = APIRouter(prefix="/capsules/{capsule_id}/recipients", tags=["Recipients"])

CapsuleId = Annotated[int, Path(ge=1, description="Capsule id")]
RecipientId = Annotated[int, Path(ge=1, description="Recipient id")]

NOT_FOUND = {404: {"model": ErrorResponse, "description": "Capsule or recipient not found"}}


@router.get("", response_model=list[RecipientOut], summary="List recipients", responses=NOT_FOUND)
def list_recipients(capsule_id: CapsuleId):
    return recipient_service.list_recipients(capsule_id)


@router.post(
    "",
    response_model=RecipientOut,
    status_code=status.HTTP_201_CREATED,
    summary="Add a recipient",
    responses={
        **NOT_FOUND,
        409: {"model": ErrorResponse, "description": "Duplicate, limit reached or capsule not sealed"},
    },
)
def add_recipient(capsule_id: CapsuleId, payload: RecipientCreate):
    return recipient_service.add_recipient(capsule_id, payload)


@router.delete(
    "/{recipient_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Remove a recipient",
    responses={**NOT_FOUND, 409: {"model": ErrorResponse, "description": "Capsule is no longer sealed"}},
)
def remove_recipient(capsule_id: CapsuleId, recipient_id: RecipientId):
    recipient_service.remove_recipient(capsule_id, recipient_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
