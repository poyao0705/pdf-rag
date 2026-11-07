import logging
import re
from collections.abc import AsyncIterator
from types import SimpleNamespace
from uuid import UUID

import httpx
import pytest
from fastapi import FastAPI, WebSocket
from fastapi.testclient import TestClient
from starlette.responses import StreamingResponse

from main import app

REQUEST_ID = "12345678-1234-4234-8234-123456789abc"
pytestmark = pytest.mark.anyio


@pytest.fixture
def anyio_backend():
    return "asyncio"


@pytest.fixture
def request_state():
    return SimpleNamespace(
        clock=10.0,
        error=RuntimeError("private failure details"),
        stream_error=RuntimeError("stream failure"),
    )


@pytest.fixture
def logging_app(request_state):
    # Exercise the registered middleware and handlers without loading secrets.
    test_app = FastAPI(middleware=list(app.user_middleware))
    test_app.exception_handlers.update(app.exception_handlers)

    @test_app.get("/success")
    async def success():
        return {"ok": True}

    @test_app.get("/failure")
    async def failure():
        request_state.clock = 11.25
        raise request_state.error

    @test_app.get("/stream")
    async def stream():
        async def chunks():
            yield b"first"
            request_state.clock = 12.5
            yield b"last"

        return StreamingResponse(chunks())

    @test_app.get("/stream-failure")
    async def stream_failure():
        async def chunks():
            yield b"first"
            request_state.clock = 13.25
            raise request_state.stream_error

        return StreamingResponse(chunks())

    @test_app.websocket("/ws")
    async def websocket(websocket: WebSocket):
        await websocket.accept()
        await websocket.send_text("pong")
        await websocket.close()

    return test_app


@pytest.fixture
async def client(logging_app) -> AsyncIterator[httpx.AsyncClient]:
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=logging_app, raise_app_exceptions=False),
        base_url="http://testserver",
    ) as client:
        yield client


def request_records(caplog: pytest.LogCaptureFixture) -> list[logging.LogRecord]:
    return [
        record
        for record in caplog.records
        if record.name in {"main", "core.middleware"}
    ]


async def test_success_is_logged_once_and_preserves_request_id(client, caplog):
    with caplog.at_level(logging.INFO):
        response = await client.get("/success", headers={"X-Request-ID": REQUEST_ID})

    assert response.status_code == 200
    assert response.json() == {"ok": True}
    assert response.headers["X-Request-ID"] == REQUEST_ID
    records = request_records(caplog)
    assert len(records) == 1
    assert records[0].levelno == logging.INFO
    assert re.search(r"GET /success 200 \d+\.\d{3}s", records[0].getMessage())


@pytest.mark.parametrize(("path", "status"), [("/success", 200), ("/failure", 500)])
async def test_request_logs_exclude_query_strings_and_authorization(
    client, caplog, path, status
):
    with caplog.at_level(logging.INFO, logger="core.middleware"):
        response = await client.get(
            path,
            params={"api_key": "test-query-secret"},
            headers={"Authorization": "Bearer test-header-secret"},
        )

    assert response.status_code == status
    records = request_records(caplog)
    assert len(records) == 1
    output = "\n".join(caplog.handler.format(record) for record in records)
    assert f"GET {path} {status}" in output
    assert "api_key" not in output
    assert "test-query-secret" not in output
    assert "Authorization" not in output
    assert "test-header-secret" not in output


@pytest.mark.parametrize(
    "headers", [{"X-Request-ID": REQUEST_ID}, {}], ids=["supplied", "generated"]
)
async def test_unhandled_500_includes_supplied_or_generated_request_id(
    client, caplog, headers
):
    with caplog.at_level(logging.ERROR):
        response = await client.get("/failure", headers=headers)

    assert response.status_code == 500
    request_id = response.headers.get("X-Request-ID")
    assert request_id is not None
    assert UUID(request_id).version == 4
    if headers:
        assert request_id == REQUEST_ID
    assert "private failure details" not in response.text


async def test_failure_log_includes_status_duration_and_traceback(
    client, caplog, monkeypatch, request_state
):
    monkeypatch.setattr(
        "core.middleware.time", SimpleNamespace(perf_counter=lambda: request_state.clock)
    )
    with caplog.at_level(logging.ERROR):
        await client.get("/failure")

    records = request_records(caplog)
    assert len(records) == 1
    assert "GET /failure 500 1.250s" in records[0].getMessage()
    assert records[0].exc_info is not None
    assert records[0].exc_info[1] is request_state.error


async def test_original_exception_is_reraised(logging_app, caplog, request_state):
    transport = httpx.ASGITransport(app=logging_app)
    async with httpx.AsyncClient(
        transport=transport, base_url="http://testserver"
    ) as client:
        with caplog.at_level(logging.ERROR), pytest.raises(RuntimeError) as raised:
            await client.get("/failure")

    assert raised.value is request_state.error


async def test_stream_duration_includes_the_complete_body(
    client, caplog, monkeypatch, request_state
):
    monkeypatch.setattr(
        "core.middleware.time", SimpleNamespace(perf_counter=lambda: request_state.clock)
    )
    with caplog.at_level(logging.INFO):
        response = await client.get("/stream")

    assert response.content == b"firstlast"
    records = request_records(caplog)
    assert len(records) == 1
    assert "GET /stream 200 2.500s" in records[0].getMessage()


async def test_stream_failure_is_logged_with_the_already_sent_status(
    client, caplog, monkeypatch, request_state
):
    monkeypatch.setattr(
        "core.middleware.time", SimpleNamespace(perf_counter=lambda: request_state.clock)
    )
    with caplog.at_level(logging.ERROR):
        response = await client.get("/stream-failure")

    assert response.status_code == 200
    assert response.content == b"first"
    records = request_records(caplog)
    assert len(records) == 1
    assert "GET /stream-failure 200 3.250s" in records[0].getMessage()
    assert records[0].exc_info is not None
    assert records[0].exc_info[1] is request_state.stream_error


def test_lifespan_and_websockets_pass_through(logging_app):
    with (
        TestClient(logging_app) as client,
        client.websocket_connect("/ws") as websocket,
    ):
        assert websocket.receive_text() == "pong"
