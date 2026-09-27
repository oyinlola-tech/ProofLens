from __future__ import annotations

import os
import sys
import time
from pathlib import Path

import pytest

from modules.documents.infrastructure.parsers import pdf_parser
from modules.documents.infrastructure.parsers.pdf_parser import PdfWorkerError, SubprocessPdfParser
from tests.fixtures.pdf_helpers import create_multi_page_pdf


async def test_parses_pdf_in_subprocess():
    result = await SubprocessPdfParser().parse_bytes(create_multi_page_pdf())
    assert result.total_pages == 3
    assert "Introduction" in result.pages[0].text
    assert result.pages[1].char_offset == len(result.pages[0].text)


async def test_respects_max_pages():
    result = await SubprocessPdfParser(max_pages=2).parse_bytes(create_multi_page_pdf())
    assert result.total_pages == 2


async def test_invalid_pdf_raises_value_error():
    with pytest.raises(ValueError, match="not a valid PDF"):
        await SubprocessPdfParser().parse_bytes(b"not a pdf")
    with pytest.raises(ValueError, match="Cannot open PDF"):
        await SubprocessPdfParser().parse_bytes(b"%PDF-1.4 garbage")


async def test_hanging_worker_is_killed_on_timeout(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    pid_file = tmp_path / "pid"
    worker = tmp_path / "slow_worker.py"
    worker.write_text(
        "import os, sys, time\n"
        f"open({str(pid_file)!r}, 'w').write(str(os.getpid()))\n"
        "sys.stdin.buffer.read()\n"
        "time.sleep(60)\n"
    )
    monkeypatch.setattr(pdf_parser, "_WORKER_PATH", str(worker))

    started = time.monotonic()
    with pytest.raises(TimeoutError):
        await SubprocessPdfParser(timeout_seconds=1).parse_bytes(b"%PDF-1.4 anything")
    assert time.monotonic() - started < 10

    pid = int(pid_file.read_text())
    with pytest.raises(ProcessLookupError):
        os.kill(pid, 0)


@pytest.mark.skipif(sys.platform == "win32", reason="resource limits are POSIX-only")
async def test_memory_limit_is_enforced():
    # 64 MB is far too little to even import pymupdf, so the worker must fail.
    with pytest.raises(PdfWorkerError):
        await SubprocessPdfParser(memory_limit_mb=64).parse_bytes(create_multi_page_pdf())


async def test_crashing_worker_raises_worker_error(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    worker = tmp_path / "crash.py"
    worker.write_text("import sys\nsys.exit(3)\n")
    monkeypatch.setattr(pdf_parser, "_WORKER_PATH", str(worker))
    with pytest.raises(PdfWorkerError, match="code 3"):
        await SubprocessPdfParser().parse_bytes(b"%PDF-1.4 anything")
