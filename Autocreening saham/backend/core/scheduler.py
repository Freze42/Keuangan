"""
core/scheduler.py
------------------
Konfigurasi `BackgroundScheduler` (APScheduler) untuk menjalankan
Data Ingestion Pipeline secara otomatis di background, terintegrasi
dengan siklus hidup (lifespan) aplikasi FastAPI.

Jadwal default: setiap hari Minggu, pukul 01:00 dini hari (waktu server),
di luar jam bursa untuk menghindari beban pada saat trading hours dan
memastikan data yang ditarik sudah settle (closing price/laporan terbaru).
"""

from __future__ import annotations

import logging

from apscheduler.executors.pool import ThreadPoolExecutor
from apscheduler.job import Job
from apscheduler.jobstores.memory import MemoryJobStore
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger

from backend.services.data_ingestion import scheduled_financial_update

logger = logging.getLogger("dcf_screener.scheduler")

JOB_ID_WEEKLY_UPDATE = "weekly_financial_statement_update"

# Konfigurasi scheduler: 1 job store in-memory, executor thread pool.
# `max_instances=1` mencegah job yang sama berjalan tumpang-tindih apabila
# eksekusi sebelumnya belum selesai (misalnya karena banyaknya emiten).
scheduler = BackgroundScheduler(
    jobstores={"default": MemoryJobStore()},
    executors={"default": ThreadPoolExecutor(max_workers=1)},
    job_defaults={
        "coalesce": True,
        "max_instances": 1,
        "misfire_grace_time": 3600,  # toleransi 1 jam jika server sempat down
    },
    timezone="Asia/Jakarta",
)


def _job_listener_wrapper() -> None:
    """
    Wrapper tipis di sekitar `scheduled_financial_update` agar exception apa
    pun yang lolos tetap tercatat di log dan tidak membuat scheduler crash
    diam-diam.
    """
    try:
        scheduled_financial_update()
    except Exception as exc:  # noqa: BLE001 - job scheduler tidak boleh mati karena error tak terduga
        logger.exception("Job terjadwal 'weekly_financial_statement_update' gagal: %s", exc)


def start_scheduler() -> BackgroundScheduler:
    """
    Mendaftarkan cron job mingguan dan memulai `BackgroundScheduler`.

    Cron job dijadwalkan setiap hari Minggu (day_of_week='sun') pukul 01:00
    waktu Asia/Jakarta (WIB), agar tidak bentrok dengan jam trading BEI
    (Senin-Jumat, 09:00-15:50 WIB).

    Fungsi ini idempotent: memanggilnya berkali-kali tidak akan mendaftarkan
    job duplikat karena menggunakan `id` job yang tetap serta `replace_existing=True`.

    Returns:
        Instance `BackgroundScheduler` yang sudah berjalan.
    """
    if not scheduler.get_job(JOB_ID_WEEKLY_UPDATE):
        scheduler.add_job(
            func=_job_listener_wrapper,
            trigger=CronTrigger(day_of_week="sun", hour=1, minute=0),
            id=JOB_ID_WEEKLY_UPDATE,
            name="Weekly Food & Beverage Financial Statement Ingestion",
            replace_existing=True,
        )
        logger.info(
            "Job '%s' terdaftar: setiap Minggu jam 01:00 WIB.", JOB_ID_WEEKLY_UPDATE
        )

    if not scheduler.running:
        scheduler.start()
        logger.info("BackgroundScheduler berhasil dijalankan.")

    return scheduler


def shutdown_scheduler(wait: bool = False) -> None:
    """
    Menghentikan scheduler dengan aman saat aplikasi FastAPI shutdown.

    Args:
        wait: Jika True, menunggu job yang sedang berjalan selesai terlebih
              dahulu sebelum benar-benar shutdown.
    """
    if scheduler.running:
        scheduler.shutdown(wait=wait)
        logger.info("BackgroundScheduler berhasil dihentikan.")


def trigger_manual_update() -> Job:
    """
    Memicu eksekusi `scheduled_financial_update` secara manual & segera
    (di luar jadwal cron), berguna untuk keperluan testing atau endpoint
    admin (misalnya `POST /admin/trigger-ingestion`).

    Returns:
        Objek `Job` APScheduler yang baru saja dijadwalkan untuk "run now".
    """
    logger.info("Memicu eksekusi manual data ingestion pipeline...")
    return scheduler.add_job(
        func=_job_listener_wrapper,
        id=f"{JOB_ID_WEEKLY_UPDATE}_manual_trigger",
        name="Manual Trigger - Financial Statement Ingestion",
        replace_existing=True,
        misfire_grace_time=60,
    )
