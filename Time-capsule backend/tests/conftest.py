"""Каждый тест получает свою схему PostgreSQL и накатывает на неё миграции."""
import os
from pathlib import Path
from uuid import uuid4

import pytest
from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.engine import make_url
from sqlalchemy.schema import CreateSchema, DropSchema

from app.database import engine
from app.main import app


@pytest.fixture
def client(monkeypatch):
    url = make_url(os.environ["TEST_DATABASE_URL"]).set(drivername="postgresql+psycopg")
    admin = create_engine(url)
    schema = "test_" + uuid4().hex
    with admin.begin() as connection:
        connection.execute(CreateSchema(schema))
    try:
        scoped = url.update_query_dict({"options": "-csearch_path=" + schema})
        monkeypatch.setenv("DATABASE_URL", scoped.render_as_string(hide_password=False))
        engine.cache_clear()
        command.upgrade(Config(str(Path(__file__).resolve().parents[1] / "alembic.ini")), "head")
        with TestClient(app) as api:
            yield api
    finally:
        engine().dispose()
        engine.cache_clear()
        with admin.begin() as connection:
            connection.execute(DropSchema(schema, cascade=True))
        admin.dispose()
