import time
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from . import models  # noqa: F401 -- ensure models are registered
from .config import get_settings
from .database import Base, SessionLocal, engine
from .routers import analyses, analyze, auth, doctors, insights, progress, tracker
from .seed import seed_dermatologists
from .storage import UPLOAD_DIR

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        seed_dermatologists(db)
    yield


app = FastAPI(title=settings.app_name, version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(analyze.router)
app.include_router(analyses.router)
app.include_router(tracker.router)
app.include_router(progress.router)
app.include_router(insights.router)
app.include_router(doctors.router)

app.mount("/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "app": settings.app_name, "time": int(time.time())}


@app.get("/")
def root() -> dict:
    return {"message": "FaceLens API", "docs": "/docs", "health": "/health"}
