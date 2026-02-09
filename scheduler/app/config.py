from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    database_url: str = "postgresql://scheduler:scheduler@localhost:5433/scheduler"
    n8n_webhook_url: str = "http://localhost:5678/webhook/linkedin-post"
    sunday_api_url: str = "http://localhost:3000/api"
    log_level: str = "INFO"


settings = Settings()
