from flask import Blueprint, jsonify, request
from .extensions import db
from .models import Item

bp = Blueprint("api", __name__)


@bp.get("/health")
def health():
    return jsonify({"status": "ok"})


@bp.get("/items")
def list_items():
    items = db.session.execute(db.select(Item)).scalars().all()
    return jsonify(
        [{"id": i.id, "name": i.name, "description": i.description} for i in items]
    )


@bp.post("/items")
def create_item():
    data = request.get_json()
    item = Item(name=data["name"], description=data.get("description", ""))
    db.session.add(item)
    db.session.commit()
    return jsonify({"id": item.id, "name": item.name}), 201
