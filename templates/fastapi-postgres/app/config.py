from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://app:secret@localhost:5432/{{PROJECT_NAME}}"
    debug: bool = False

    model_config = {"env_file": ".env"}


settings = Settings()
