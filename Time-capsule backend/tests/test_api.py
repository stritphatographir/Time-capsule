from datetime import datetime, timedelta, timezone

from app.services import capsule_service


def future(days=30):
    return (datetime.now(timezone.utc) + timedelta(days=days)).isoformat()


def make(client, **overrides):
    body = {"title": "Hello", "message": "Dear me", "openAt": future()}
    body.update(overrides)
    return client.post("/capsules", json=body)


def time_travel(monkeypatch, days):
    monkeypatch.setattr(capsule_service, "utcnow", lambda: datetime.now(timezone.utc) + timedelta(days=days))


# create / read / update / delete 

def test_create_capsule_hides_letter(client):
    response = make(client, song={"title": "Dreams", "artist": "Fleetwood Mac"})
    assert response.status_code == 201
    data = response.json()
    assert data["id"] == 1
    assert data["status"] == "sealed"
    assert data["recipientCount"] == 0
    assert "message" not in data or data["message"] is None
    assert data.get("song") is None
    assert response.headers["Location"] == f"/capsules/{data['id']}"
    assert response.headers["Cache-Control"] == "no-store"


def test_create_invalid_body_returns_422(client):
    response = client.post("/capsules", json={"title": "   ", "message": "", "openAt": "not a date"})
    assert response.status_code == 422
    body = response.json()["error"]
    assert body["code"] == "validation_error"
    assert {f["field"] for f in body["fields"]} == {"body.title", "body.message", "body.openAt"}


def test_create_past_or_too_far_date_returns_400(client):
    past = make(client, openAt=future(-1))
    far = make(client, openAt=future(365 * 51))
    assert past.status_code == 400 and past.json()["error"]["code"] == "invalid_open_date"
    assert far.status_code == 400


def test_get_missing_capsule_returns_404(client):
    response = client.get("/capsules/999")
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "capsule_not_found"
    assert response.headers["Cache-Control"] == "no-store"


def test_get_with_bad_id_returns_422(client):
    assert client.get("/capsules/abc").status_code == 422
    assert client.get("/capsules/0").status_code == 422


def test_list_filters_search_and_paging(client):
    make(client, title="Birthday wishes")
    make(client, title="Exam notes")
    make(client, title="Birthday party")

    assert len(client.get("/capsules").json()) == 3
    assert len(client.get("/capsules?search=birthday").json()) == 2
    assert len(client.get("/capsules?status=sealed").json()) == 3
    assert client.get("/capsules?status=opened").json() == []
    assert len(client.get("/capsules?limit=1&offset=1").json()) == 1
    assert client.get("/capsules?status=wrong").status_code == 422
    assert client.get("/capsules?limit=0").status_code == 422


def test_patch_updates_sealed_capsule(client):
    make(client)
    response = client.patch("/capsules/1", json={"title": "New title"})
    assert response.status_code == 200
    assert response.json()["title"] == "New title"


def test_patch_validation(client):
    make(client)
    assert client.patch("/capsules/1", json={}).status_code == 422
    assert client.patch("/capsules/1", json={"title": None}).status_code == 422
    assert client.patch("/capsules/1", json={"openAt": future(-1)}).status_code == 400
    assert client.patch("/capsules/42", json={"title": "x"}).status_code == 404


def test_patch_not_allowed_after_date(client, monkeypatch):
    make(client)
    time_travel(monkeypatch, 60)
    response = client.patch("/capsules/1", json={"title": "Too late"})
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "capsule_not_editable"


def test_delete_removes_capsule_and_recipients(client):
    make(client)
    client.post("/capsules/1/recipients", json={"email": "a@b.co"})
    assert client.delete("/capsules/1").status_code == 204
    assert client.get("/capsules/1").status_code == 404
    assert client.get("/capsules/1/recipients").status_code == 404
    assert client.delete("/capsules/1").status_code == 404


def test_open_before_date_is_forbidden(client):
    make(client)
    response = client.post("/capsules/1/open")
    assert response.status_code == 403
    assert response.json()["error"]["code"] == "capsule_locked"


def test_ready_capsule_still_hides_letter_until_opened(client, monkeypatch):
    make(client, song={"title": "Dreams", "artist": "Fleetwood Mac"})
    time_travel(monkeypatch, 60)
    data = client.get("/capsules/1").json()
    assert data["status"] == "ready"
    assert data.get("message") is None


def test_open_reveals_letter_and_song_then_conflicts(client, monkeypatch):
    make(client, message="Secret text", song={"title": "Dreams", "artist": "Fleetwood Mac"})
    time_travel(monkeypatch, 60)

    opened = client.post("/capsules/1/open")
    assert opened.status_code == 200
    assert opened.headers["Cache-Control"] == "no-store"
    data = opened.json()
    assert data["status"] == "opened"
    assert data["message"] == "Secret text"
    assert data["song"]["artist"] == "Fleetwood Mac"
    assert data["openedAt"] is not None

    assert client.get("/capsules/1").json()["message"] == "Secret text"
    again = client.post("/capsules/1/open")
    assert again.status_code == 409
    assert again.json()["error"]["code"] == "already_opened"
    assert client.post("/capsules/77/open").status_code == 404


#recipients

def test_add_list_and_remove_recipients(client):
    make(client)
    added = client.post("/capsules/1/recipients", json={"email": "Friend@Example.com", "name": "  Aigerim "})
    assert added.status_code == 201
    assert added.json()["email"] == "friend@example.com"
    assert added.json()["name"] == "Aigerim"

    assert client.get("/capsules/1").json()["recipientCount"] == 1
    assert len(client.get("/capsules/1/recipients").json()) == 1

    assert client.delete("/capsules/1/recipients/1").status_code == 204
    assert client.get("/capsules/1").json()["recipientCount"] == 0
    assert client.delete("/capsules/1/recipients/1").status_code == 404


def test_recipient_errors(client):
    make(client)
    make(client, title="Second")
    client.post("/capsules/1/recipients", json={"email": "a@b.co"})

    duplicate = client.post("/capsules/1/recipients", json={"email": "A@B.co"})
    assert duplicate.status_code == 409
    assert duplicate.json()["error"]["code"] == "duplicate_recipient"

    assert client.post("/capsules/1/recipients", json={"email": "not-an-email"}).status_code == 422
    assert client.post("/capsules/99/recipients", json={"email": "x@y.co"}).status_code == 404
    # Recipient 1 belongs to capsule 1; it cannot be deleted through capsule 2.
    assert client.delete("/capsules/2/recipients/1").status_code == 404


def test_recipient_limit(client):
    make(client)
    for i in range(20):
        assert client.post("/capsules/1/recipients", json={"email": f"user{i}@mail.com"}).status_code == 201
    over = client.post("/capsules/1/recipients", json={"email": "one-more@mail.com"})
    assert over.status_code == 409
    assert over.json()["error"]["code"] == "recipient_limit_reached"


def test_recipients_locked_after_date(client, monkeypatch):
    make(client)
    client.post("/capsules/1/recipients", json={"email": "a@b.co"})
    time_travel(monkeypatch, 60)
    assert client.post("/capsules/1/recipients", json={"email": "c@d.co"}).status_code == 409
    assert client.delete("/capsules/1/recipients/1").status_code == 409


def test_unknown_route_uses_same_error_format(client):
    response = client.get("/nothing-here")
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "http_error"
