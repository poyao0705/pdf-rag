import logging
from contextlib import asynccontextmanager

from asgi_correlation_id import CorrelationIdMiddleware, correlation_id
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from core.config import get_settings
from core.logging import configure_logging
from core.middleware import RequestLoggingMiddleware

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):

    # settings = Settings()  # type: ignore
    settings = get_settings()
    configure_logging(settings.LOG_LEVEL)
    logger.info("Application starting.")

    try:
        yield
    finally:
        logger.info("Application stopped.")


app = FastAPI(lifespan=lifespan)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    return JSONResponse(
        status_code=500,
        content={
            "detail": "Internal server error, Request ID: "
            + (correlation_id.get() or "")
        },
        headers={"X-Request-ID": correlation_id.get() or ""},
    )


app.add_middleware(RequestLoggingMiddleware)
app.add_middleware(CorrelationIdMiddleware)


@app.get("/")
def main():
    return {"message": "Hello World"}


@app.get("/error")
def error():
    raise Exception("Test error")
