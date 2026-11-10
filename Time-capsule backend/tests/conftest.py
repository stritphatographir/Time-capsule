import pytest
from fastapi.testclient import TestClient

from app import storage
from app.main import app


@pytest.fixture(autouse=True)
def clean_storage():
    storage.reset()
    yield
    storage.reset()


@pytest.fixture
def client():
    return TestClient(app)
