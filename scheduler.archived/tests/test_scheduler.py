"""Tests for the Sunday Scheduler Service.

Uses an in-memory jobstore so no Postgres dependency is needed.
"""

from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock, patch

import pytest
from apscheduler.executors.pool import ThreadPoolExecutor
from apscheduler.jobstores.memory import MemoryJobStore
from apscheduler.schedulers.background import BackgroundScheduler
from httpx import ASGITransport, AsyncClient

# --- Inject in-memory scheduler BEFORE the app imports it ---

_test_scheduler = BackgroundScheduler(
    jobstores={"default": MemoryJobStore()},
    executors={"default": ThreadPoolExecutor(max_workers=5)},
    job_defaults={
        "coalesce": False,
        "max_instances": 1,
        "misfire_grace_time": 3600,
    },
    timezone="UTC",
)

# Inject immediately so any subsequent get_scheduler() returns the test instance
from app.scheduler import set_scheduler  # noqa: E402

set_scheduler(_test_scheduler)

# Patch recover_missed_posts before importing app to prevent startup catch-up
# from making real HTTP calls
with patch("app.main.recover_missed_posts", return_value=0):
    from app.main import app  # noqa: E402


@pytest.fixture(autouse=True)
def _reset_scheduler():
    """Start the scheduler before each test, clean up after."""
    from app.jobs import _retry_counts

    if not _test_scheduler.running:
        _test_scheduler.start(paused=False)
    yield
    _test_scheduler.remove_all_jobs()
    _retry_counts.clear()


@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


# -- Health endpoint --


@pytest.mark.anyio
async def test_health(client: AsyncClient):
    resp = await client.get("/health")
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "healthy"
    assert body["scheduler_running"] is True
    assert isinstance(body["pending_jobs"], int)


# -- POST /schedule --


@pytest.mark.anyio
async def test_create_schedule(client: AsyncClient):
    future = (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat()
    resp = await client.post(
        "/schedule",
        json={"post_id": "abc123", "scheduled_at": future},
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["job_id"] == "post-abc123"
    assert body["post_id"] == "abc123"
    assert body["status"] == "scheduled"


@pytest.mark.anyio
async def test_create_duplicate_schedule_returns_409(client: AsyncClient):
    future = (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat()
    await client.post(
        "/schedule",
        json={"post_id": "dup1", "scheduled_at": future},
    )
    resp = await client.post(
        "/schedule",
        json={"post_id": "dup1", "scheduled_at": future},
    )
    assert resp.status_code == 409


# -- GET /schedule/{post_id} --


@pytest.mark.anyio
async def test_get_schedule(client: AsyncClient):
    future = (datetime.now(timezone.utc) + timedelta(hours=2)).isoformat()
    await client.post(
        "/schedule",
        json={"post_id": "get1", "scheduled_at": future},
    )
    resp = await client.get("/schedule/get1")
    assert resp.status_code == 200
    assert resp.json()["status"] == "scheduled"


@pytest.mark.anyio
async def test_get_missing_schedule_returns_404(client: AsyncClient):
    resp = await client.get("/schedule/nonexistent")
    assert resp.status_code == 404


# -- DELETE /schedule/{post_id} --


@pytest.mark.anyio
async def test_cancel_schedule(client: AsyncClient):
    future = (datetime.now(timezone.utc) + timedelta(hours=3)).isoformat()
    await client.post(
        "/schedule",
        json={"post_id": "del1", "scheduled_at": future},
    )
    resp = await client.delete("/schedule/del1")
    assert resp.status_code == 200
    assert resp.json()["status"] == "cancelled"

    # Verify it's gone
    resp = await client.get("/schedule/del1")
    assert resp.status_code == 404


@pytest.mark.anyio
async def test_cancel_missing_schedule_returns_404(client: AsyncClient):
    resp = await client.delete("/schedule/ghost")
    assert resp.status_code == 404


# -- PUT /schedule/{post_id} --


@pytest.mark.anyio
async def test_reschedule_post(client: AsyncClient):
    future1 = (datetime.now(timezone.utc) + timedelta(hours=4)).isoformat()
    future2 = (datetime.now(timezone.utc) + timedelta(hours=8)).isoformat()

    await client.post(
        "/schedule",
        json={"post_id": "resch1", "scheduled_at": future1},
    )
    resp = await client.put(
        "/schedule/resch1",
        json={"scheduled_at": future2},
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "rescheduled"


@pytest.mark.anyio
async def test_reschedule_nonexistent_creates_new(client: AsyncClient):
    """PUT on a non-existing schedule should create it (idempotent upsert)."""
    future = (datetime.now(timezone.utc) + timedelta(hours=5)).isoformat()
    resp = await client.put(
        "/schedule/newone",
        json={"scheduled_at": future},
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "rescheduled"


# -- Job execution --


def test_trigger_linkedin_publish():
    """Verify the job function patches status to publishing then calls n8n webhook."""
    with patch("app.jobs.httpx.Client") as MockClient:
        mock_response = MagicMock()
        mock_response.raise_for_status = MagicMock()
        mock_response.status_code = 200
        mock_response.text = "ok"

        mock_instance = MagicMock()
        mock_instance.patch.return_value = mock_response
        mock_instance.post.return_value = mock_response
        mock_instance.__enter__ = MagicMock(return_value=mock_instance)
        mock_instance.__exit__ = MagicMock(return_value=False)

        MockClient.return_value = mock_instance

        from app.jobs import trigger_linkedin_publish

        trigger_linkedin_publish("test-post-id")

        # Should PATCH status to "publishing" first
        mock_instance.patch.assert_called_once()
        patch_args = mock_instance.patch.call_args
        assert "/posts/test-post-id" in patch_args.args[0]
        assert patch_args.kwargs["json"] == {"status": "publishing"}

        # Then POST to n8n webhook
        mock_instance.post.assert_called_once()
        post_args = mock_instance.post.call_args
        assert post_args.kwargs["json"] == {"postId": "test-post-id"}


# -- Validation --


@pytest.mark.anyio
async def test_create_schedule_missing_fields(client: AsyncClient):
    resp = await client.post("/schedule", json={})
    assert resp.status_code == 422


@pytest.mark.anyio
async def test_create_schedule_empty_post_id(client: AsyncClient):
    future = (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat()
    resp = await client.post(
        "/schedule",
        json={"post_id": "", "scheduled_at": future},
    )
    assert resp.status_code == 422


# -- Retry logic --


def test_trigger_publish_retries_on_failure():
    """On failure, the job should schedule a retry instead of raising."""
    from app.jobs import _retry_counts, clear_retry_count, trigger_linkedin_publish

    with patch("app.jobs.httpx.Client") as MockClient:
        mock_instance = MagicMock()
        mock_response = MagicMock()
        mock_response.raise_for_status.side_effect = Exception("n8n down")
        mock_response.status_code = 200
        mock_response.text = ""

        # PATCH succeeds, POST to n8n fails
        patch_response = MagicMock()
        patch_response.raise_for_status = MagicMock()
        patch_response.status_code = 200

        mock_instance.patch.return_value = patch_response
        mock_instance.post.return_value = mock_response
        mock_instance.__enter__ = MagicMock(return_value=mock_instance)
        mock_instance.__exit__ = MagicMock(return_value=False)
        MockClient.return_value = mock_instance

        # Simulate httpx.HTTPError on the post call
        import httpx as real_httpx
        mock_instance.post.side_effect = real_httpx.ConnectError("n8n down")

        trigger_linkedin_publish("retry-post")

        # Should have scheduled a retry (retry count incremented)
        assert _retry_counts.get("retry-post") == 1

        # Should have a retry job in the scheduler
        job = _test_scheduler.get_job("post-retry-post")
        assert job is not None

        # Clean up
        clear_retry_count("retry-post")


def test_trigger_publish_marks_failed_after_max_retries():
    """After MAX_RETRIES, the post should be marked as failed."""
    from app.jobs import MAX_RETRIES, _retry_counts, trigger_linkedin_publish

    # Pre-set retry count to max so next failure exhausts retries
    _retry_counts["exhaust-post"] = MAX_RETRIES

    with patch("app.jobs.httpx.Client") as MockClient:
        mock_instance = MagicMock()
        mock_instance.__enter__ = MagicMock(return_value=mock_instance)
        mock_instance.__exit__ = MagicMock(return_value=False)

        # PATCH for publishing status succeeds
        patch_response = MagicMock()
        patch_response.raise_for_status = MagicMock()
        patch_response.status_code = 200
        mock_instance.patch.return_value = patch_response

        # POST to n8n fails
        import httpx as real_httpx
        mock_instance.post.side_effect = real_httpx.ConnectError("n8n still down")

        MockClient.return_value = mock_instance

        trigger_linkedin_publish("exhaust-post")

        # Should have called PATCH twice: once for "publishing", once for "failed"
        assert mock_instance.patch.call_count == 2
        fail_call = mock_instance.patch.call_args_list[1]
        assert fail_call.kwargs["json"]["status"] == "failed"
        assert "errorMessage" in fail_call.kwargs["json"]

        # Retry count should be cleared
        assert "exhaust-post" not in _retry_counts


def test_trigger_publish_clears_retry_on_success():
    """On success, retry count should be cleared."""
    from app.jobs import _retry_counts, trigger_linkedin_publish

    # Simulate a post that already has 1 retry
    _retry_counts["success-post"] = 1

    with patch("app.jobs.httpx.Client") as MockClient:
        mock_response = MagicMock()
        mock_response.raise_for_status = MagicMock()
        mock_response.status_code = 200
        mock_response.text = "ok"

        mock_instance = MagicMock()
        mock_instance.patch.return_value = mock_response
        mock_instance.post.return_value = mock_response
        mock_instance.__enter__ = MagicMock(return_value=mock_instance)
        mock_instance.__exit__ = MagicMock(return_value=False)
        MockClient.return_value = mock_instance

        trigger_linkedin_publish("success-post")

        # Retry count should be cleared on success
        assert "success-post" not in _retry_counts


# -- Catch-up mechanism --


def test_recover_missed_posts():
    """recover_missed_posts should re-register overdue posts."""
    from app.catchup import recover_missed_posts

    past_time = (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()
    mock_posts = [
        {"id": "missed-1", "scheduledAt": past_time, "status": "scheduled"},
        {"id": "missed-2", "scheduledAt": past_time, "status": "scheduled"},
    ]

    with patch("app.catchup.httpx.Client") as MockClient:
        mock_response = MagicMock()
        mock_response.raise_for_status = MagicMock()
        mock_response.json.return_value = mock_posts
        mock_response.status_code = 200

        mock_instance = MagicMock()
        mock_instance.get.return_value = mock_response
        mock_instance.__enter__ = MagicMock(return_value=mock_instance)
        mock_instance.__exit__ = MagicMock(return_value=False)
        MockClient.return_value = mock_instance

        recovered = recover_missed_posts()

    assert recovered == 2
    assert _test_scheduler.get_job("post-missed-1") is not None
    assert _test_scheduler.get_job("post-missed-2") is not None


def test_recover_skips_future_posts():
    """recover_missed_posts should NOT re-register posts scheduled in the future."""
    from app.catchup import recover_missed_posts

    future_time = (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat()
    mock_posts = [
        {"id": "future-1", "scheduledAt": future_time, "status": "scheduled"},
    ]

    with patch("app.catchup.httpx.Client") as MockClient:
        mock_response = MagicMock()
        mock_response.raise_for_status = MagicMock()
        mock_response.json.return_value = mock_posts

        mock_instance = MagicMock()
        mock_instance.get.return_value = mock_response
        mock_instance.__enter__ = MagicMock(return_value=mock_instance)
        mock_instance.__exit__ = MagicMock(return_value=False)
        MockClient.return_value = mock_instance

        recovered = recover_missed_posts()

    assert recovered == 0
    assert _test_scheduler.get_job("post-future-1") is None


def test_recover_skips_already_registered():
    """recover_missed_posts should skip posts that already have a pending job."""
    from app.catchup import recover_missed_posts
    from app.jobs import trigger_linkedin_publish

    past_time = (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()

    # Pre-register a job for this post
    _test_scheduler.add_job(
        trigger_linkedin_publish,
        trigger="date",
        run_date=datetime.now(timezone.utc) + timedelta(minutes=5),
        args=["already-scheduled"],
        id="post-already-scheduled",
    )

    mock_posts = [
        {"id": "already-scheduled", "scheduledAt": past_time, "status": "scheduled"},
    ]

    with patch("app.catchup.httpx.Client") as MockClient:
        mock_response = MagicMock()
        mock_response.raise_for_status = MagicMock()
        mock_response.json.return_value = mock_posts

        mock_instance = MagicMock()
        mock_instance.get.return_value = mock_response
        mock_instance.__enter__ = MagicMock(return_value=mock_instance)
        mock_instance.__exit__ = MagicMock(return_value=False)
        MockClient.return_value = mock_instance

        recovered = recover_missed_posts()

    assert recovered == 0


def test_recover_handles_api_error():
    """recover_missed_posts should return 0 when the API is unreachable."""
    from app.catchup import recover_missed_posts

    with patch("app.catchup.httpx.Client") as MockClient:
        import httpx as real_httpx

        mock_instance = MagicMock()
        mock_instance.get.side_effect = real_httpx.ConnectError("API down")
        mock_instance.__enter__ = MagicMock(return_value=mock_instance)
        mock_instance.__exit__ = MagicMock(return_value=False)
        MockClient.return_value = mock_instance

        recovered = recover_missed_posts()

    assert recovered == 0
