from apscheduler.executors.pool import ThreadPoolExecutor
from apscheduler.jobstores.sqlalchemy import SQLAlchemyJobStore
from apscheduler.schedulers.background import BackgroundScheduler

from app.config import settings

_scheduler: BackgroundScheduler | None = None


def get_scheduler() -> BackgroundScheduler:
    """Lazily create the scheduler on first access (avoids import-time DB connection)."""
    global _scheduler
    if _scheduler is None:
        _scheduler = BackgroundScheduler(
            jobstores={"default": SQLAlchemyJobStore(url=settings.database_url)},
            executors={"default": ThreadPoolExecutor(max_workers=10)},
            job_defaults={
                "coalesce": False,
                "max_instances": 1,
                "misfire_grace_time": 3600,
            },
            timezone="UTC",
        )
    return _scheduler


def set_scheduler(s: BackgroundScheduler) -> None:
    """Override the scheduler instance (used by tests)."""
    global _scheduler
    _scheduler = s
