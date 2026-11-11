"""Read song metadata and stream previews from the iTunes catalog."""
from urllib.parse import urlsplit

from httpx import AsyncClient, HTTPError
from pydantic import ValidationError

from app.exceptions import MusicSearchUnavailableError
from app.schemas.capsule import Song

SEARCH_URL = "https://itunes.apple.com/search"
RESULT_LIMIT = 8
APPLE_MEDIA_DOMAINS = ("apple.com", "mzstatic.com")


def _media_url(value: object) -> str | None:
    if not isinstance(value, str) or len(value) > 1000:
        return None
    try:
        url = urlsplit(value)
        host = url.hostname or ""
        if url.scheme != "https" or url.username is not None or url.port not in (None, 443):
            return None
    except ValueError:
        return None
    if any(host == domain or host.endswith(f".{domain}") for domain in APPLE_MEDIA_DOMAINS):
        return value
    return None


async def search_itunes(term: str) -> list[Song]:
    try:
        async with AsyncClient(timeout=5.0) as client:
            response = await client.get(
                SEARCH_URL,
                params={
                    "term": term,
                    "country": "US",
                    "media": "music",
                    "entity": "song",
                    "limit": RESULT_LIMIT,
                },
            )
            response.raise_for_status()
            data = response.json()
    except (HTTPError, ValueError) as exc:
        raise MusicSearchUnavailableError(
            "Couldn’t reach the iTunes catalog. Try searching again in a moment."
        ) from exc

    if not isinstance(data, dict) or not isinstance(data.get("results"), list):
        raise MusicSearchUnavailableError("iTunes returned an unexpected response. Try searching again.")

    songs = []
    for result in data["results"][:RESULT_LIMIT]:
        if not isinstance(result, dict) or result.get("kind") != "song":
            continue
        try:
            song = Song(
                title=result.get("trackName"),
                artist=result.get("artistName"),
                preview_url=_media_url(result.get("previewUrl")),
                artwork=_media_url(result.get("artworkUrl100")) or _media_url(result.get("artworkUrl60")),
            )
        except ValidationError:
            continue
        songs.append(song)
    return songs
