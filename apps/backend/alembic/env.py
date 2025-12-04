from __future__ import annotations

import os
import sys
from logging.config import fileConfig

from sqlalchemy import engine_from_config, pool
from sqlalchemy.engine import Connection
from alembic import context

# Alembic Config object, provides access to values within the .ini file
config = context.config

# Interpret the config file for Python logging.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)


# Ensure project root (the folder that contains 'apps/') is on sys.path
BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), os.pardir, os.pardir, os.pardir))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

# Load app metadata
def get_target_metadata():
    # Import models to register them on Base.metadata
    from apps.backend.app.db.base import Base
    import apps.backend.app.pms.models  # noqa: F401

    return Base.metadata


target_metadata = get_target_metadata()


def _get_database_url() -> str:
    # Prefer env var if present; fallback to app settings
    from apps.backend.app.core.config import settings

    url = os.getenv("DATABASE_URL", settings.database_url)
    # Alembic needs sync driver; convert asyncpg URL if necessary
    if url.startswith("postgresql+asyncpg"):
        url = url.replace("postgresql+asyncpg", "postgresql+psycopg", 1)
    return url


def run_migrations_offline() -> None:
    url = _get_database_url()
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        compare_type=True,
        compare_server_default=True,
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    configuration = config.get_section(config.config_ini_section) or {}
    configuration["sqlalchemy.url"] = _get_database_url()

    connectable = engine_from_config(
        configuration,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:  # type: Connection
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
            compare_server_default=True,
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
