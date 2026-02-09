import { log } from "@/lib/logger";

const SCHEDULER_URL =
  process.env.SCHEDULER_URL || "http://localhost:8000";

interface SchedulerResponse {
  job_id: string;
  post_id: string;
  scheduled_at: string;
  status: string;
}

/**
 * Register a post with the FastAPI scheduler service.
 * The scheduler will fire a webhook to n8n at the scheduled time.
 */
export async function scheduleWithScheduler(
  postId: string,
  scheduledAt: string
): Promise<SchedulerResponse> {
  log("info", "Registering post with scheduler", { postId, scheduledAt });

  const response = await fetch(`${SCHEDULER_URL}/schedule`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      post_id: postId,
      scheduled_at: scheduledAt,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    log("error", "Failed to register with scheduler", {
      postId,
      status: response.status,
      error,
    });
    throw new Error(`Scheduler registration failed: ${error}`);
  }

  const data = (await response.json()) as SchedulerResponse;
  log("info", "Post registered with scheduler", {
    postId,
    jobId: data.job_id,
  });
  return data;
}

/**
 * Cancel a scheduled post in the FastAPI scheduler service.
 * Silently succeeds if the job doesn't exist (404 is not an error).
 */
export async function cancelSchedule(postId: string): Promise<void> {
  log("info", "Cancelling schedule", { postId });

  const response = await fetch(`${SCHEDULER_URL}/schedule/${postId}`, {
    method: "DELETE",
  });

  if (!response.ok && response.status !== 404) {
    const error = await response.text();
    log("error", "Failed to cancel schedule", {
      postId,
      status: response.status,
      error,
    });
    throw new Error(`Schedule cancellation failed: ${error}`);
  }

  log("info", "Schedule cancelled", { postId });
}

/**
 * Reschedule an existing post in the FastAPI scheduler service.
 * Creates a new job if one doesn't exist (PUT is idempotent).
 */
export async function reschedule(
  postId: string,
  scheduledAt: string
): Promise<SchedulerResponse> {
  log("info", "Rescheduling post", { postId, scheduledAt });

  const response = await fetch(`${SCHEDULER_URL}/schedule/${postId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      post_id: postId,
      scheduled_at: scheduledAt,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    log("error", "Failed to reschedule", {
      postId,
      status: response.status,
      error,
    });
    throw new Error(`Reschedule failed: ${error}`);
  }

  const data = (await response.json()) as SchedulerResponse;
  log("info", "Post rescheduled", { postId, jobId: data.job_id });
  return data;
}
