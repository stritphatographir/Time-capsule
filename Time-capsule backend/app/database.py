"""API и Alembic берут адрес базы из одной переменной DATABASE_URL."""
import os
from functools import lru_cache
from typing import Annotated

from fastapi import Depends
from sqlalchemy import create_engine
from sqlalchemy.engine import make_url
from sqlalchemy.orm import Session


def database_url():
    raw = os.environ.get("DATABASE_URL")
    if not raw:
        raise RuntimeError("Set DATABASE_URL to your PostgreSQL connection URL.")
    url = make_url(raw)
    if url.get_backend_name() != "postgresql":
        raise ValueError("DATABASE_URL must point to PostgreSQL.")
    return url.set(drivername="postgresql+psycopg")


# Пул соединений общий для процесса, а сессия у каждого запроса своя.
@lru_cache
def engine():
    return create_engine(database_url(), pool_pre_ping=True)


def get_session():
    # После commit() сервис ещё читает поля для ответа. Сохраняем их в сессии до конца запроса.
    with Session(engine(), expire_on_commit=False) as session:
        yield session


DB = Annotated[Session, Depends(get_session)]
