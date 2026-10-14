import logging
import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.api.collaboration import router as collaboration_router
from app.api.routes import router
from app.core.config import settings
from app.core.errors import http_error_handler, unhandled_error_handler
from app.services.email_queue import start_email_worker, stop_email_worker

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")


@asynccontextmanager
async def lifespan(_: FastAPI):
    start_email_worker()
    try:
        yield
    finally:
        stop_email_worker()


app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    description="Team and work management API. Contract at docs/API.md.",
    openapi_url="/openapi.json",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_exception_handler(StarletteHTTPException, http_error_handler)
app.add_exception_handler(Exception, unhandled_error_handler)


@app.middleware("http")
async def request_context(request: Request, call_next):
    request_id = request.headers.get("x-request-id") or str(uuid.uuid4())
    response = await call_next(request)
    response.headers["x-request-id"] = request_id
    return response


app.include_router(router, prefix=settings.api_v1_prefix)
app.include_router(collaboration_router, prefix=settings.api_v1_prefix)
