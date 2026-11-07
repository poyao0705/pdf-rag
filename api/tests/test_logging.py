import re
import subprocess
import sys
import textwrap
from collections.abc import Callable
from pathlib import Path

import pytest


@pytest.fixture
def run_logging() -> Callable[[str], str]:
    def run(code: str) -> str:
        # dictConfig changes global handlers; keep it isolated from other tests.
        result = subprocess.run(
            [
                sys.executable,
                "-B",
                "-c",
                "import logging\n"
                "from core.logging import configure_logging\n" + textwrap.dedent(code),
            ],
            cwd=Path(__file__).resolve().parents[1],
            capture_output=True,
            text=True,
            check=False,
        )
        assert result.returncode == 0, result.stderr
        assert result.stderr == ""
        return result.stdout

    return run


def test_console_includes_correlation_id_and_prints_message_once(run_logging):
    request_id = "57506b32259545a0aab158666966f8aa"
    output = run_logging(f"""
        from asgi_correlation_id import correlation_id

        configure_logging()
        correlation_id.set("{request_id}")
        logging.getLogger("core.middleware").info("request complete")
    """)

    assert f"[{request_id}]" in output
    assert "[core.middleware]" in output
    assert re.search(r"\bINFO\b.*request complete", output)
    assert output.count("request complete") == 1


def test_console_uses_fallback_id_outside_requests(run_logging):
    output = run_logging("""
        configure_logging()
        logging.getLogger("main").info("application starting")
    """)

    assert "[-]" in output
    assert "[main]" in output
    assert re.search(r"\bINFO\b.*application starting", output)
    assert output.count("application starting") == 1


def test_configured_level_suppresses_lower_priority_messages(run_logging):
    output = run_logging("""
        configure_logging("warning")
        logger = logging.getLogger("core.middleware")
        logger.debug("hidden-debug")
        logger.info("hidden-info")
        logger.warning("visible-warning")
        logger.error("visible-error")
    """)

    assert "hidden-debug" not in output
    assert "hidden-info" not in output
    assert re.search(r"\bWARNING\b.*visible-warning", output)
    assert re.search(r"\bERROR\b.*visible-error", output)


def test_uvicorn_error_is_printed_once(run_logging):
    output = run_logging("""
        configure_logging()
        logging.getLogger("uvicorn.error").error("server failure")
    """)

    assert "[-]" in output
    assert "[uvicorn.error]" in output
    assert re.search(r"\bERROR\b.*server failure", output)
    assert output.count("server failure") == 1


def test_exception_output_includes_error_message_and_traceback(run_logging):
    output = run_logging("""
        configure_logging()
        try:
            raise RuntimeError("simulated failure")
        except RuntimeError:
            logging.getLogger("core.middleware").exception("request failed")
    """)

    assert re.search(r"\bERROR\b.*request failed", output)
    assert "Traceback (most recent call last):" in output
    assert "RuntimeError: simulated failure" in output
