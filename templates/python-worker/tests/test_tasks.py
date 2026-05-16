import pytest
from src.worker.tasks import process_item


@pytest.mark.asyncio
async def test_process_item_returns_result():
    ctx: dict = {}
    result = await process_item(ctx, item_id=42, payload={"foo": "bar"})
    assert result["item_id"] == 42
    assert result["status"] == "processed"
    assert result["payload"] == {"foo": "bar"}
