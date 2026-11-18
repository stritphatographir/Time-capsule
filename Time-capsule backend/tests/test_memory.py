from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import engine
from app.models import Recipient
from app.services import capsule_service


def test_prediction_reflection_and_anniversary(client, monkeypatch):
    now = datetime(2030, 4, 15, 12, tzinfo=timezone.utc)
    monkeypatch.setattr(capsule_service, "utcnow", lambda: now)
    payload = {"title": "Graduation", "message": "Remember this day", "prediction": "I'll teach art",
               "openAt": (now + timedelta(days=1)).isoformat()}
    response = client.post("/capsules", json=payload)
    assert response.status_code == 201
    path = f"/capsules/{response.json()['id']}"
    assert response.json()["prediction"] is None
    assert client.put(path + "/reflection", json={"text": "Too soon"}).status_code == 403
    now += timedelta(days=1)
    assert client.get("/capsules").json()[0]["prediction"] is None
    assert client.post(path + "/open").json()["prediction"] == payload["prediction"]
    assert client.put(path + "/reflection", json={"text": "   "}).status_code == 422
    assert client.put(path + "/reflection", json={"text": "I teach ceramics!"}).status_code == 200
    # Читаем через новое соединение: ответ должен сохраниться в базе.
    engine().dispose()
    assert client.get(path).json()["reflection"] == "I teach ceramics!"
    assert client.get("/capsules/anniversaries?day=2030-04-16").json() == []
    assert client.get("/capsules/anniversaries?day=2031-04-15").json() == []
    assert client.get("/capsules/anniversaries?day=2031-04-16").json()[0]["id"] == response.json()["id"]


def test_recipient_cascade(client):
    date = datetime.now(timezone.utc) + timedelta(days=1)
    created = client.post("/capsules", json={"title": "Trip", "message": "Hello", "openAt": date.isoformat()})
    path = f"/capsules/{created.json()['id']}"
    assert client.post(path + "/recipients", json={"email": "friend@example.com"}).status_code == 201
    assert client.delete(path).status_code == 204
    with Session(engine()) as session:
        assert session.scalar(select(Recipient.id)) is None
