from datetime import datetime

from pydantic import BaseModel, Field


class ScheduleRequest(BaseModel):
    post_id: str = Field(..., min_length=1, description="Unique post identifier")
    scheduled_at: datetime = Field(..., description="UTC datetime to publish")


class RescheduleRequest(BaseModel):
    scheduled_at: datetime = Field(..., description="New UTC datetime to publish")


class ScheduleResponse(BaseModel):
    job_id: str
    post_id: str
    scheduled_at: datetime
    status: str


class CancelResponse(BaseModel):
    status: str
    post_id: str


class HealthResponse(BaseModel):
    status: str
    scheduler_running: bool
    pending_jobs: int
