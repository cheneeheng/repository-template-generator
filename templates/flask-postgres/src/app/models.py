from datetime import datetime, UTC
from .extensions import db


class Item(db.Model):
    __tablename__ = "items"

    id: int = db.Column(db.Integer, primary_key=True)
    name: str = db.Column(db.String(255), nullable=False)
    description: str = db.Column(db.Text, default="")
    created_at: datetime = db.Column(
        db.DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
    )
