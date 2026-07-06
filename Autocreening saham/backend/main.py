"""
main.py
-------
Entrypoint aplikasi FastAPI untuk "Automated DCF Stock Screener".

Modul ini bertanggung jawab untuk:
1. Menginisialisasi tabel database (opsional, untuk kemudahan development).
2. Mendaftarkan & menjalankan `BackgroundScheduler` (APScheduler) melalui
   `lifespan` event handler, sehingga job cron mingguan otomatis start
   saat aplikasi FastAPI dinyalakan dan berhenti dengan bersih saat aplikasi
   dimatikan.
3. Menyediakan endpoint dasar: health check dan trigger manual ingestion
   (berguna untuk debugging/testing tanpa harus menunggu jadwal cron).

Menjalankan aplikasi:
    uvicorn backend.main:app --reload
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from typing import AsyncIterator

from fastapi import Depends, FastAPI, HTTPException, status
from sqlalchemy import text
from sqlalchemy.orm import Session

from backend.core.scheduler import (
    scheduler,
    shutdown_scheduler,
    start_scheduler,
    trigger_manual_update,
)
from backend.database import Base, engine, get_db

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)
logger = logging.getLogger("dcf_screener.main")


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """
    Lifespan event handler FastAPI.

    - STARTUP: membuat tabel (jika belum ada) & menjalankan BackgroundScheduler
      sehingga cron job "weekly_financial_statement_update" aktif.
    - SHUTDOWN: menghentikan scheduler secara graceful agar tidak ada thread
      job yang menggantung saat proses aplikasi dimatikan.
    """
    logger.info("Menjalankan startup sequence aplikasi...")

    # Catatan: pada lingkungan production, gunakan Alembic migration,
    # bukan `create_all`, untuk mengelola perubahan skema database.
    Base.metadata.create_all(bind=engine)

    start_scheduler()
    logger.info("Aplikasi siap. Scheduler aktif dengan job: %s", scheduler.get_jobs())

    yield

    logger.info("Menjalankan shutdown sequence aplikasi...")
    shutdown_scheduler(wait=False)


app = FastAPI(
    title="Automated DCF Stock Screener - IHSG Food & Beverage",
    description=(
        "Backend service untuk menarik, mengolah, dan menyimpan data fundamental "
        "emiten sektor Food & Beverage BEI sebagai parameter model DCF."
    ),
    version="1.0.0",
    lifespan=lifespan,
)


@app.get("/api/health", tags=["Monitoring"])
def health_check(db: Session = Depends(get_db)) -> dict:
    """Mengecek status aplikasi & konektivitas database."""
    try:
        db.execute(text("SELECT 1"))
        db_status = "connected"
    except Exception as exc:  # noqa: BLE001
        logger.error("Health check database gagal: %s", exc)
        db_status = "disconnected"

    return {
        "status": "ok",
        "database": db_status,
        "scheduler_running": scheduler.running,
        "jobs": [job.id for job in scheduler.get_jobs()],
    }


@app.post("/admin/trigger-ingestion", tags=["Admin"], status_code=status.HTTP_202_ACCEPTED)
def trigger_ingestion_now() -> dict:
    """
    Memicu Data Ingestion Pipeline secara manual & segera, tanpa harus
    menunggu jadwal cron mingguan (hari Minggu jam 01:00).

    Job dijalankan secara asynchronous di background thread milik scheduler,
    sehingga endpoint ini langsung merespons tanpa menunggu proses selesai.
    """
    if not scheduler.running:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Scheduler belum berjalan.",
        )

    job = trigger_manual_update()
    return {
        "message": "Data ingestion pipeline berhasil dipicu secara manual.",
        "job_id": job.id,
        "next_run_time": str(job.next_run_time),
    }
