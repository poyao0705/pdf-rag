import logging.config


def configure_logging(level: str = "INFO") -> None:
    level = level.upper()

    logging.config.dictConfig(
        {
            "version": 1,
            "disable_existing_loggers": False,
            "filters": {
                "correlation_id": {
                    "()": "asgi_correlation_id.CorrelationIdFilter",
                    "uuid_length": 32,
                    "default_value": "-",
                },
            },
            "formatters": {
                "standard": {
                    "format": "%(asctime)s [%(correlation_id)s] [%(name)s] %(levelname)s: %(message)s",
                },
            },
            "handlers": {
                "console": {
                    "class": "logging.StreamHandler",
                    "filters": ["correlation_id"],
                    "formatter": "standard",
                    "stream": "ext://sys.stdout",
                },
            },
            "root": {
                "handlers": ["console"],
                "level": level,
            },
            "loggers": {
                "uvicorn": {
                    "handlers": ["console"],
                    "level": level,
                    "propagate": False,
                },
                "uvicorn.error": {
                    "level": level,
                },
                "uvicorn.access": {
                    "handlers": ["console"],
                    "level": "INFO",
                    "propagate": False,
                },
            },
        }
    )
