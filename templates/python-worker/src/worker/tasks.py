from arq import ArqRedis


async def process_item(ctx: dict, item_id: int, payload: dict) -> dict:
    """Process a single item. Replace with your business logic."""
    # ctx["redis"] is an ArqRedis connection available for sub-task queuing.
    result = {"item_id": item_id, "status": "processed", "payload": payload}
    return result


async def startup(ctx: dict) -> None:
    pass


async def shutdown(ctx: dict) -> None:
    pass
