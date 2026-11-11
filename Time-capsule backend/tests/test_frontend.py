def test_fastapi_serves_the_frontend_and_keeps_the_api_routes(client):
    homepage = client.get("/app/")
    assert homepage.status_code == 200
    assert homepage.headers["Content-Type"].startswith("text/html")
    assert 'href="create.html"' in homepage.text

    for path in ("index.html", "create.html", "dashboard.html", "capsule.html", "css/styles.css", "js/api.js"):
        assert client.get(f"/app/{path}").status_code == 200
    assert isinstance(client.get("/app/capsules.json").json(), list)
    assert client.get("/app", follow_redirects=False).headers["Location"].endswith("/app/")

    assert client.get("/").json()["docs"] == "/docs"
    assert client.get("/docs").status_code == 200
    assert client.get("/healthz").json() == {"status": "ok"}
    assert client.get("/capsules").json() == []


def test_frontend_does_not_serve_repository_files(client):
    for path in ("README.md", "PRODUCT.md", ".git/config", "Time-capsule%20backend/requirements.txt"):
        assert client.get(f"/app/{path}").status_code == 404


def test_local_live_server_keeps_access_to_the_api(client):
    origin = "http://127.0.0.1:5500"
    response = client.options(
        "/capsules",
        headers={
            "Origin": origin,
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type",
        },
    )
    assert response.status_code == 200
    assert response.headers["Access-Control-Allow-Origin"] == origin
