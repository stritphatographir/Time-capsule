import httpx
import pytest

from app.services import music_service


def mock_catalog(monkeypatch, handler):
    def catalog_client(**options):
        return httpx.AsyncClient(transport=httpx.MockTransport(handler), **options)

    monkeypatch.setattr(music_service, "AsyncClient", catalog_client)


def test_search_returns_safe_song_metadata(client, monkeypatch):
    def catalog(request):
        assert request.url.host == "itunes.apple.com"
        assert request.url.path == "/search"
        assert request.url.params["term"] == "Daft Punk"
        assert request.url.params["entity"] == "song"
        assert request.url.params["limit"] == "8"
        return httpx.Response(
            200,
            json={
                "results": [
                    {
                        "kind": "song",
                        "trackName": "One More Time",
                        "artistName": "Daft Punk",
                        "previewUrl": "https://audio-ssl.itunes.apple.com/sample.m4a",
                        "artworkUrl100": "https://is1-ssl.mzstatic.com/sample.jpg",
                    },
                    {
                        "kind": "song",
                        "trackName": "Around the World",
                        "artistName": "Daft Punk",
                        "previewUrl": "https://itunes.apple.com.invalid/sample.m4a",
                    },
                    {"kind": "music-video", "trackName": "One More Time", "artistName": "Daft Punk"},
                    {"kind": "song", "trackName": "Incomplete result"},
                ],
            },
        )

    mock_catalog(monkeypatch, catalog)
    response = client.get("/songs/search", params={"q": "  Daft Punk  "})
    assert response.status_code == 200
    assert response.json() == [
        {
            "title": "One More Time",
            "artist": "Daft Punk",
            "previewUrl": "https://audio-ssl.itunes.apple.com/sample.m4a",
            "artwork": "https://is1-ssl.mzstatic.com/sample.jpg",
        },
        {"title": "Around the World", "artist": "Daft Punk", "previewUrl": None, "artwork": None},
    ]


@pytest.mark.parametrize("query", ["  ", "x" * 101])
def test_invalid_search_skips_catalog(client, monkeypatch, query):
    def catalog(request):
        pytest.fail("Invalid search was sent to iTunes")

    mock_catalog(monkeypatch, catalog)
    response = client.get("/songs/search", params={"q": query})
    assert response.status_code == 422
    assert response.json()["error"]["fields"][0]["field"] == "query.q"


@pytest.mark.parametrize("catalog_status,payload", [(403, None), (200, {"unexpected": []})])
def test_search_reports_upstream_failure(client, monkeypatch, catalog_status, payload):
    mock_catalog(monkeypatch, lambda request: httpx.Response(catalog_status, json=payload))
    response = client.get("/songs/search", params={"q": "Daft Punk"})
    assert response.status_code == 502
    assert response.json()["error"]["code"] == "music_search_unavailable"
