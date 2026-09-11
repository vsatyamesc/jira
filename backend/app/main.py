import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .config import CORS_ORIGINS, BASE_DIR
from .database import init_db
from .routers import (
    sprints_router,
    tasks_router,
    time_slots_router,
    schedule_router,
    timesheet_router,
    export_router,
    utils_router,
)

def create_app() -> FastAPI:
    app = FastAPI(title="ChronoJira API", version="2.0.0")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.on_event("startup")
    def on_startup():
        init_db()

    # Include API Routers
    app.include_router(sprints_router)
    app.include_router(tasks_router)
    app.include_router(time_slots_router)
    app.include_router(schedule_router)
    app.include_router(timesheet_router)
    app.include_router(export_router)
    app.include_router(utils_router)

    # Static files mounting
    frontend_dist = os.path.join(BASE_DIR, "frontend", "dist")
    static_fallback = os.path.join(BASE_DIR, "static")

    if os.path.exists(frontend_dist):
        app.mount("/", StaticFiles(directory=frontend_dist, html=True), name="frontend")
    elif os.path.exists(static_fallback):
        app.mount("/", StaticFiles(directory=static_fallback, html=True), name="static")

    return app

app = create_app()
