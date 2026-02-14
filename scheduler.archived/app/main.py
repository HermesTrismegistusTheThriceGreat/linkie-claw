import logging
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI

from app.catchup import CATCHUP_INTERVAL_SECONDS, recover_missed_posts
from app.models import HealthResponse
from app.routes import schedule
from app.scheduler import get_scheduler

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s — %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncGenerator[None, None]:
    sched = get_scheduler()
    sched.start()
    logger.info("Scheduler started with %d pending jobs", len(sched.get_jobs()))

    # Run catch-up for missed posts on startup
    recovered = recover_missed_posts()
    logger.info("Startup catch-up recovered %d post(s)", recovered)

    # Schedule periodic catch-up every 5 minutes
    sched.add_job(
        recover_missed_posts,
        trigger="interval",
        seconds=CATCHUP_INTERVAL_SECONDS,
        id="catchup-missed-posts",
        replace_existing=True,
    )
    logger.info("Periodic catch-up scheduled every %d seconds", CATCHUP_INTERVAL_SECONDS)

    yield
    sched.shutdown()
    logger.info("Scheduler shut down")


app = FastAPI(
    title="Sunday Scheduler Service",
    description="APScheduler-based post scheduling for LinkedIn publishing",
    version="1.0.0",
    lifespan=lifespan,
)

app.include_router(schedule.router, prefix="/schedule", tags=["scheduling"])


@app.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    sched = get_scheduler()
    return HealthResponse(
        status="healthy",
        scheduler_running=sched.running,
        pending_jobs=len(sched.get_jobs()),
    )
