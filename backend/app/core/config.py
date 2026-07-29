from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "GerBar Load Planner API"
    app_version: str = "1.0.0"
    database_url: str = "sqlite:///./gerbar_load_planner.db"
    secret_key: str = "gerbar-development-secret-change-in-production"
    token_expire_minutes: int = 480


settings = Settings()
