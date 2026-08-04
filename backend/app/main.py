from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.core.config import settings
from app.db.database import Base, SessionLocal, engine
from app.services.bootstrap import create_initial_admin


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        create_initial_admin(db)
    finally:
        db.close()
    yield


app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description="API principal para planificación y optimización de cargas.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:5175",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
        "http://127.0.0.1:5175",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api/v1")


@app.get("/", tags=["Sistema"])
def root():
    return {
        "application": settings.app_name,
        "version": settings.app_version,
        "status": "running",
    }


@app.get("/health", tags=["Sistema"])
def health():
    return {"status": "ok"}
