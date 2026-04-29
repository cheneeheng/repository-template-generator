from fastapi import FastAPI

from app.routers import items

app = FastAPI(title="{{PROJECT_NAME}}")

app.include_router(items.router)


@app.get("/health")
async def health():
    return {"status": "ok"}
