from typing import Annotated

from fastapi import APIRouter, Query
from pydantic import StringConstraints

from app.schemas.capsule import Song
from app.schemas.errors import ErrorResponse
from app.services.music_service import search_itunes

router = APIRouter(prefix="/songs", tags=["Songs"])
SearchTerm = Annotated[
    str,
    StringConstraints(strip_whitespace=True, min_length=1, max_length=100),
    Query(description="Search by song title or artist"),
]


@router.get(
    "/search",
    summary="Search iTunes for songs",
    responses={
        422: {"model": ErrorResponse, "description": "Invalid search term"},
        502: {"model": ErrorResponse, "description": "Music catalog unavailable"},
    },
)
async def search_songs(q: SearchTerm) -> list[Song]:
    return await search_itunes(q)
