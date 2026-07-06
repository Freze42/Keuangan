"""
database.py
------------
Konfigurasi koneksi database PostgreSQL menggunakan SQLAlchemy.

Modul ini menyediakan:
- `engine`      : SQLAlchemy engine yang terhubung ke PostgreSQL.
- `SessionLocal`: Factory untuk membuat session database per-request/per-job.
- `Base`        : Deklarasi base class untuk seluruh model ORM.
- `get_db`      : Dependency generator untuk FastAPI route handler.
"""

from __future__ import annotations

import os
from contextlib import contextmanager
from typing import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

# Contoh: postgresql+psycopg2://user:password@localhost:5432/dcf_screener_db
DATABASE_URL: str = os.getenv(
    "DATABASE_URL",
    "postgresql+psycopg2://postgres:postgres@localhost:5432/dcf_screener_db",
)

engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,  # Menghindari koneksi 'stale' saat idle lama (penting untuk cron job)
    pool_size=5,
    max_overflow=10,
    future=True,
)

SessionLocal = sessionmaker(
    bind=engine,
    autocommit=False,
    autoflush=False,
    future=True,
)


class Base(DeclarativeBase):
    """Base class deklaratif untuk seluruh model ORM di aplikasi ini."""


def get_db() -> Generator[Session, None, None]:
    """
    Dependency FastAPI untuk mendapatkan sesi database per-request.

    Menjamin session selalu ditutup meskipun terjadi exception,
    mencegah connection leak pada connection pool.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@contextmanager
def get_db_session() -> Generator[Session, None, None]:
    """
    Context manager untuk mendapatkan sesi database di luar konteks request
    FastAPI, misalnya di dalam background job / scheduler (APScheduler).

    Contoh penggunaan:
        with get_db_session() as db:
            db.query(Company).all()
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
