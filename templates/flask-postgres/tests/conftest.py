import pytest
from src.app import create_app
from src.app.config import Config
from src.app.extensions import db as _db


class TestConfig(Config):
    TESTING: bool = True
    SQLALCHEMY_DATABASE_URI: str = "sqlite:///:memory:"


@pytest.fixture
def app():
    app = create_app(TestConfig())
    with app.app_context():
        _db.create_all()
        yield app
        _db.drop_all()


@pytest.fixture
def client(app):
    return app.test_client()
