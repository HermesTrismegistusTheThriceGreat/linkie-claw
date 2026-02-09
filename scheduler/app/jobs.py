import logging
import time
from datetime import datetime, timedelta, timezone

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

MAX_RETRIES = 3
RETRY_DELAY_SECONDS = 120  # 2 minutes

# In-memory retry tracker: post_id -> retry count
_retry_counts: dict[str, int] = {}


def get_retry_count(post_id: str) -> int:
    """Get current retry count for a post."""
    return _retry_counts.get(post_id, 0)


def clear_retry_count(post_id: str) -> None:
    """Clear retry tracking for a post (on success or after giving up)."""
    _retry_counts.pop(post_id, None)


def _mark_post_failed(post_id: str, error_message: str) -> None:
    """PATCH the post status to 'failed' after exhausting retries."""
    with httpx.Client() as client:
        try:
            client.patch(
                f"{settings.sunday_api_url}/posts/{post_id}",
                json={"status": "failed", "errorMessage": error_message},
                timeout=10.0,
            )
            logger.info("Marked post %s as failed: %s", post_id, error_message)
        except httpx.HTTPError as exc:
            logger.error("Failed to mark post %s as failed: %s", post_id, exc)


def _schedule_retry(post_id: str, retry_number: int) -> None:
    """Re-schedule the post for retry after a delay."""
    from app.scheduler import get_scheduler

    sched = get_scheduler()
    run_date = datetime.now(timezone.utc) + timedelta(seconds=RETRY_DELAY_SECONDS)
    job_id = f"post-{post_id}"

    # Remove existing job if present (the original date trigger is consumed)
    existing = sched.get_job(job_id)
    if existing:
        sched.remove_job(job_id)

    sched.add_job(
        trigger_linkedin_publish,
        trigger="date",
        run_date=run_date,
        args=[post_id],
        id=job_id,
        replace_existing=True,
    )
    logger.info(
        "Scheduled retry %d/%d for post %s at %s",
        retry_number, MAX_RETRIES, post_id, run_date.isoformat(),
    )


def trigger_linkedin_publish(post_id: str) -> None:
    """
    Called by APScheduler at the scheduled time.
    Fires webhook to n8n to initiate LinkedIn publishing.
    On failure, retries up to MAX_RETRIES times with RETRY_DELAY_SECONDS between attempts.
    """
    retry_count = get_retry_count(post_id)
    attempt = retry_count + 1
    logger.info("Triggering publish for post %s (attempt %d/%d)", post_id, attempt, MAX_RETRIES + 1)

    with httpx.Client() as client:
        try:
            # Mark post as "publishing" before triggering n8n
            patch_start = time.monotonic()
            publish_response = client.patch(
                f"{settings.sunday_api_url}/posts/{post_id}",
                json={"status": "publishing"},
                timeout=10.0,
            )
            patch_duration = round((time.monotonic() - patch_start) * 1000)
            publish_response.raise_for_status()
            logger.info(
                "Marked post %s as publishing (status=%d, duration=%dms)",
                post_id, publish_response.status_code, patch_duration,
            )

            n8n_start = time.monotonic()
            response = client.post(
                settings.n8n_webhook_url,
                json={"postId": post_id},
                timeout=30.0,
            )
            n8n_duration = round((time.monotonic() - n8n_start) * 1000)
            response.raise_for_status()

            # Log n8n response for debugging (truncate if very long)
            response_text = response.text[:500] if response.text else "(empty)"
            logger.info(
                "Successfully triggered n8n for post %s (status=%d, duration=%dms, body=%s)",
                post_id, response.status_code, n8n_duration, response_text,
            )

            # Success — clear retry tracking
            clear_retry_count(post_id)

        except httpx.HTTPError as exc:
            # Include response body in error log when available
            response_body = None
            if hasattr(exc, "response") and exc.response is not None:
                response_body = exc.response.text[:500] if exc.response.text else "(empty)"
            logger.error(
                "Failed to trigger n8n for post %s (attempt %d/%d): %s (response_body=%s)",
                post_id, attempt, MAX_RETRIES + 1, exc, response_body,
            )

            if retry_count < MAX_RETRIES:
                # Schedule a retry
                _retry_counts[post_id] = retry_count + 1
                _schedule_retry(post_id, retry_count + 1)
            else:
                # Exhausted all retries — mark as failed
                clear_retry_count(post_id)
                _mark_post_failed(
                    post_id,
                    f"Failed after {MAX_RETRIES + 1} attempts. Last error: {exc}",
                )
