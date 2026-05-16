from pydantic_settings import BaseSettings


class Config(BaseSettings):
    SQLALCHEMY_DATABASE_URI: str = (
        "postgresql+psycopg://app:secret@localhost:5432/app_db"
    )
    SQLALCHEMY_TRACK_MODIFICATIONS: bool = False
    SECRET_KEY: str = "dev-secret-change-in-production"

    model_config = {"env_file": ".env"}
