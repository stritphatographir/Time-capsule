from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import engine
from app.models import CapsuleNote
from app.services import capsule_service


def create(client, now):
    response = client.post("/capsules", json={
        "title": "Class of 2030", "message": "We made it",
        "openAt": (now + timedelta(days=1)).isoformat(),
    })
    assert response.status_code == 201
    return f"/capsules/{response.json()['id']}"


def test_notes_stay_hidden_until_opened(client, monkeypatch):
    now = datetime(2030, 1, 1, tzinfo=timezone.utc)
    monkeypatch.setattr(capsule_service, "utcnow", lambda: now)
    path = create(client, now)
    assert client.get(path).json()["notes"] == []
    notes = [{"signature": "Ana", "text": "Remember the lake?"}, {"signature": "Bo", "text": "I kept the photo."}]
    for count, note in enumerate(notes, start=1):
        response = client.post(path + "/notes", json=note)
        assert response.status_code == 201
        assert response.json() == {"noteCount": count}
    for state in ("sealed", "ready"):
        detail = client.get(path).json()
        assert detail["status"] == state
        assert detail["noteCount"] == 2 and detail["notes"] == []
        assert "notes" not in client.get("/capsules").json()[0]
        now += timedelta(days=1)
    assert client.post(path + "/notes", json=notes[0]).status_code == 409
    assert client.post(path + "/open").json()["notes"] == notes
    engine().dispose()
    assert client.get(path).json()["notes"] == notes
    assert client.post(path + "/notes", json=notes[0]).status_code == 409
    assert client.delete(path).status_code == 204
    with Session(engine()) as session:
        assert session.scalar(select(CapsuleNote.id)) is None


def test_note_validation_and_concurrent_limit(client):
    path = create(client, datetime.now(timezone.utc)) + "/notes"
    note = {"signature": "Ana", "text": "Hi!"}
    assert client.post("/capsules/99999/notes", json=note).status_code == 404
    for invalid in ({"signature": "  "}, {"text": ""}, {"text": "a" * 601}, {"signature": "a" * 81}):
        assert client.post(path, json={**note, **invalid}).status_code == 422
    for _ in range(19):
        assert client.post(path, json=note).status_code == 201
    # На последнее место одновременно претендуют две записки.
    with ThreadPoolExecutor(max_workers=2) as pool:
        responses = list(pool.map(lambda _: client.post(path, json=note), range(2)))
    assert sorted(response.status_code for response in responses) == [201, 409]
    assert client.get(path.removesuffix("/notes")).json()["noteCount"] == 20
