"""APScheduler bootstrap. Nightly link check and SQLite backup."""
from __future__ import annotations

import logging

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger

from app.config import settings


log = logging.getLogger(__name__)
_scheduler: BackgroundScheduler | None = None


def _run_linkcheck() -> None:
    from app.services.linkcheck import check_all_links
    log.info("Nightly link check starting")
    try:
        n = check_all_links()
        log.info("Link check done — %d bookmarks checked", n)
    except Exception:
        log.exception("Link check failed")


def _run_backup() -> None:
    from app.services.backup import run_backup, prune_old
    log.info("Nightly SQLite backup starting")
    try:
        path = run_backup()
        log.info("Backup written to %s", path)
        prune_old()
    except Exception:
        log.exception("Backup failed")


def start_scheduler() -> None:
    global _scheduler
    if _scheduler is not None:
        return
    _scheduler = BackgroundScheduler(timezone="UTC")
    _scheduler.add_job(
        _run_linkcheck,
        CronTrigger(hour=settings.linkcheck_hour, minute=0),
        id="linkcheck",
        replace_existing=True,
    )
    _scheduler.add_job(
        _run_backup,
        CronTrigger(hour=settings.backup_hour, minute=0),
        id="backup",
        replace_existing=True,
    )
    _scheduler.start()
    log.info("Scheduler started — linkcheck @ %02d:00, backup @ %02d:00 (UTC)",
             settings.linkcheck_hour, settings.backup_hour)


def shutdown_scheduler() -> None:
    global _scheduler
    if _scheduler is not None:
        _scheduler.shutdown(wait=False)
        _scheduler = None
