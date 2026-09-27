from __future__ import annotations

import asyncio
import json
import math
import sys
from pathlib import Path
from typing import Any

from modules.documents.infrastructure.parsers import ExtractedPage, ParsedDocument
from modules.documents.infrastructure.parsers.pdf_worker import extract_pdf, is_pdf_bytes

_WORKER_PATH = str(Path(__file__).with_name("pdf_worker.py"))


class PdfWorkerError(RuntimeError):
    """The extraction subprocess crashed or was killed (e.g. by its memory limit)."""


def _to_parsed(payload: dict[str, Any]) -> ParsedDocument:
    return ParsedDocument(
        pages=[ExtractedPage(**page) for page in payload["pages"]],
        metadata=payload["metadata"],
    )


class PdfParser:
    """In-process extraction. Only for trusted input and tests; uploads use SubprocessPdfParser."""

    def __init__(self, max_pages: int = 1000) -> None:
        self._max_pages = max_pages

    def parse_file(self, file_path: str) -> ParsedDocument:
        try:
            data = Path(file_path).read_bytes()
        except OSError as e:
            raise ValueError(f"Cannot read file: {e}") from e
        return self.parse_bytes(data)

    def parse_bytes(self, data: bytes) -> ParsedDocument:
        return _to_parsed(extract_pdf(data, self._max_pages))


class SubprocessPdfParser:
    """Parses each PDF in a short-lived subprocess with a timeout and resource limits."""

    def __init__(
        self,
        max_pages: int = 1000,
        timeout_seconds: float = 60.0,
        memory_limit_mb: int = 1024,
        max_concurrency: int = 4,
    ) -> None:
        self._max_pages = max_pages
        self._timeout_seconds = timeout_seconds
        self._memory_limit_mb = memory_limit_mb
        # Shared across requests, so it bounds how many workers run at once.
        self._slots = asyncio.Semaphore(max_concurrency)

    async def parse_bytes(self, data: bytes) -> ParsedDocument:
        if not is_pdf_bytes(data):
            raise ValueError("File is not a valid PDF (bad header signature)")

        async with self._slots:
            process = await asyncio.create_subprocess_exec(
                sys.executable,
                "-I",
                _WORKER_PATH,
                str(self._max_pages),
                str(self._memory_limit_mb),
                str(math.ceil(self._timeout_seconds) + 1),
                stdin=asyncio.subprocess.PIPE,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            try:
                stdout, _ = await asyncio.wait_for(
                    process.communicate(data), timeout=self._timeout_seconds
                )
            except BaseException:
                # Timeout or request cancelled: never leave the worker running.
                if process.returncode is None:
                    process.kill()
                    await process.wait()
                raise

        if process.returncode != 0:
            raise PdfWorkerError(f"PDF worker exited with code {process.returncode}")
        try:
            payload = json.loads(stdout)
        except json.JSONDecodeError as e:
            raise PdfWorkerError("PDF worker returned invalid output") from e
        if "error" in payload:
            raise ValueError(payload["error"])
        return _to_parsed(payload)
