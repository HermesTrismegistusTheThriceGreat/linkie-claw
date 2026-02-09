import logging

from fastapi import APIRouter, HTTPException

from app.jobs import trigger_linkedin_publish
from app.models import CancelResponse, RescheduleRequest, ScheduleRequest, ScheduleResponse
from app.scheduler import get_scheduler

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("", response_model=ScheduleResponse, status_code=201)
async def create_schedule(request: ScheduleRequest) -> ScheduleResponse:
    """Schedule a post for publishing at a specific time."""
    sched = get_scheduler()
    job_id = f"post-{request.post_id}"

    existing = sched.get_job(job_id)
    if existing:
        raise HTTPException(
            status_code=409,
            detail=f"Post {request.post_id} is already scheduled",
        )

    sched.add_job(
        trigger_linkedin_publish,
        trigger="date",
        run_date=request.scheduled_at,
        args=[request.post_id],
        id=job_id,
        replace_existing=False,
    )

    logger.info("Scheduled post %s for %s", request.post_id, request.scheduled_at)

    return ScheduleResponse(
        job_id=job_id,
        post_id=request.post_id,
        scheduled_at=request.scheduled_at,
        status="scheduled",
    )


@router.delete("/{post_id}", response_model=CancelResponse)
async def cancel_schedule(post_id: str) -> CancelResponse:
    """Cancel a scheduled post."""
    sched = get_scheduler()
    job_id = f"post-{post_id}"
    job = sched.get_job(job_id)

    if not job:
        raise HTTPException(
            status_code=404,
            detail=f"No schedule found for post {post_id}",
        )

    sched.remove_job(job_id)
    logger.info("Cancelled schedule for post %s", post_id)

    return CancelResponse(status="cancelled", post_id=post_id)


@router.put("/{post_id}", response_model=ScheduleResponse)
async def reschedule_post(post_id: str, request: RescheduleRequest) -> ScheduleResponse:
    """Reschedule an existing post to a new time."""
    sched = get_scheduler()
    job_id = f"post-{post_id}"

    existing = sched.get_job(job_id)
    if existing:
        sched.remove_job(job_id)

    sched.add_job(
        trigger_linkedin_publish,
        trigger="date",
        run_date=request.scheduled_at,
        args=[post_id],
        id=job_id,
        replace_existing=False,
    )

    logger.info("Rescheduled post %s to %s", post_id, request.scheduled_at)

    return ScheduleResponse(
        job_id=job_id,
        post_id=post_id,
        scheduled_at=request.scheduled_at,
        status="rescheduled",
    )


@router.get("/{post_id}", response_model=ScheduleResponse)
async def get_schedule(post_id: str) -> ScheduleResponse:
    """Get schedule status for a post."""
    sched = get_scheduler()
    job_id = f"post-{post_id}"
    job = sched.get_job(job_id)

    if not job:
        raise HTTPException(
            status_code=404,
            detail=f"No schedule found for post {post_id}",
        )

    return ScheduleResponse(
        job_id=job_id,
        post_id=post_id,
        scheduled_at=job.next_run_time,
        status="scheduled",
    )
