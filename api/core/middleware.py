import logging
import time

from starlette.types import ASGIApp, Message, Receive, Scope, Send

logger = logging.getLogger(__name__)


class RequestLoggingMiddleware:
    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        start_time = time.perf_counter()
        status_code = 500

        async def send_response(message: Message) -> None:
            nonlocal status_code
            if message["type"] == "http.response.start":
                status_code = message["status"]
            await send(message)

        try:
            await self.app(scope, receive, send_response)
        except Exception:
            logger.exception(
                "%s %s %s %.3fs",
                scope["method"],
                scope["path"],
                status_code,
                time.perf_counter() - start_time,
            )
            raise
        else:
            logger.info(
                "%s %s %s %.3fs",
                scope["method"],
                scope["path"],
                status_code,
                time.perf_counter() - start_time,
            )
