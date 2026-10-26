"""Application composition: middleware, error handlers and route registration."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.core.exceptions import register_exception_handlers
from app.core.logging import configure_console_encoding
from app.lifespan import lifespan
from app.routers import (
    admin,
    auth,
    class_curriculum,
    classes,
    compiler,
    curriculum,
    devices,
    health,
    learning,
    progress,
    quizzes,
    reports,
    root,
    simulations,
    telemetry,
)
from app.websocket.routes import router as websocket_router

API_ROUTERS = (
    admin.router,
    classes.router,
    classes.config_router,
    class_curriculum.router,
    class_curriculum.public_router,
    health.router,
    learning.router,
    quizzes.router,
    reports.router,
    auth.router,
    compiler.router,
    curriculum.router,
    telemetry.router,
    devices.router,
    simulations.router,
    progress.router,
    root.router,
    websocket_router,
)


def create_app() -> FastAPI:
    """Build the ASGI app without opening database, Redis or MQTT connections."""
    configure_console_encoding()
    app = FastAPI(
        title="CubeSat Ground Station API",
        description="Backend cho hệ thống Ground Station CubeSat PTIT-STEM",
        version="2.0.0",
        lifespan=lifespan,
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=get_settings().allowed_origins_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    register_exception_handlers(app)

    @app.middleware("http")
    async def private_curriculum(request, call_next):
        response = await call_next(request)
        if request.url.path.startswith(("/api/curriculum", "/api/classes", "/api/attempts")):
            response.headers["Cache-Control"] = "no-store"
        return response

    for router in API_ROUTERS:
        app.include_router(router)
    return app
