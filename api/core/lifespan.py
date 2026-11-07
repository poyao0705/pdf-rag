import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI

from core.config import get_settings
from core.logging import configure_logging

# Preserve the existing startup/shutdown log category.
logger = logging.getLogger("main")


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    configure_logging(settings.LOG_LEVEL)
    logger.info("Application starting.")

    try:
        yield
    finally:
        logger.info("Application stopped.")
