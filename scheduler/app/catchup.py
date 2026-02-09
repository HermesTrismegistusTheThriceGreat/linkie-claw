"""Catch-up mechanism for posts that missed their scheduled time.

On startup and periodically (every 5 minutes), queries the Next.js API for posts
with status="scheduled" whose scheduled_at is in the past, and re-registers them
with APScheduler to fire after a short delay.
"""

import logging
from datetime import datetime, timedelta, timezone

import httpx

from app.config import settings
from app.jobs import trigger_linkedin_publish
from app.scheduler import get_scheduler

logger = logging.getLogger(__name__)

CATCHUP_DELAY_SECONDS = 30
CATCHUP_INTERVAL_SECONDS = 300  # 5 minutes


def recover_missed_posts() -> int:
    """
    Query the Next.js API for scheduled posts that are past due,
    and re-register them with APScheduler.

    Returns the number of recovered posts.
    """
    sched = get_scheduler()
    recovered = 0
    now = datetime.now(timezone.utc)

    try:
        with httpx.Client() as client:
            response = client.get(
                f"{settings.sunday_api_url}/posts",
                params={"status": "scheduled"},
                timeout=15.0,
            )
            response.raise_for_status()
            posts = response.json()
    except httpx.HTTPError as exc:
        logger.error("Failed to fetch scheduled posts for catch-up: %s", exc)
        return 0

    if not isinstance(posts, list):
        # API might wrap in an object — handle both {"posts": [...]} and [...]
        posts = posts.get("posts", []) if isinstance(posts, dict) else []

    for post in posts:
        post_id = post.get("id")
        scheduled_at_raw = post.get("scheduledAt") or post.get("scheduled_at")
        if not post_id or not scheduled_at_raw:
            continue

        # Parse the scheduled time
        try:
            if isinstance(scheduled_at_raw, str):
                # Handle both ISO formats with and without Z suffix
                scheduled_at_str = scheduled_at_raw.replace("Z", "+00:00")
                scheduled_at = datetime.fromisoformat(scheduled_at_str)
            else:
                continue
        except (ValueError, TypeError):
            logger.warning("Could not parse scheduled_at for post %s: %s", post_id, scheduled_at_raw)
            continue

        # Ensure timezone-aware
        if scheduled_at.tzinfo is None:
            scheduled_at = scheduled_at.replace(tzinfo=timezone.utc)

        # Only recover posts that are past due
        if scheduled_at >= now:
            continue

        job_id = f"post-{post_id}"

        # Skip if already registered in APScheduler
        if sched.get_job(job_id):
            logger.debug("Post %s already has a pending job, skipping", post_id)
            continue

        run_date = now + timedelta(seconds=CATCHUP_DELAY_SECONDS)
        sched.add_job(
            trigger_linkedin_publish,
            trigger="date",
            run_date=run_date,
            args=[post_id],
            id=job_id,
            replace_existing=True,
        )
        recovered += 1
        logger.info(
            "Recovered missed post %s (was due %s, rescheduled to %s)",
            post_id, scheduled_at.isoformat(), run_date.isoformat(),
        )

    if recovered:
        logger.info("Catch-up complete: recovered %d missed post(s)", recovered)
    else:
        logger.info("Catch-up complete: no missed posts found")

    return recovered
