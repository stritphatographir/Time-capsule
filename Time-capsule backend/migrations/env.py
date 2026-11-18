from alembic import context
from sqlalchemy import create_engine, pool

from app.database import database_url
from app.models import Base

# В режиме --sql Alembic печатает SQL без подключения к базе.
if context.is_offline_mode():
    context.configure(url=database_url(), target_metadata=Base.metadata, literal_binds=True)
    with context.begin_transaction():
        context.run_migrations()
else:
    with create_engine(database_url(), poolclass=pool.NullPool).connect() as connection:
        context.configure(connection=connection, target_metadata=Base.metadata)
        with context.begin_transaction():
            context.run_migrations()
