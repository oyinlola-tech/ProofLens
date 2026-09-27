"""PDF text extraction, runnable as an isolated subprocess.

A hostile or broken PDF can make the parser hang or exhaust memory. Running it in a
separate process lets the API kill it on timeout and cap its memory and CPU, which is
impossible for a thread.

This file must stay self-contained (only the standard library and pymupdf) because it
is executed directly with ``python -I pdf_worker.py``.

Usage: ``python -I pdf_worker.py <max_pages> <memory_limit_mb> <cpu_seconds>``
with the PDF bytes on stdin. Writes ``{"pages": [...], "metadata": {...}}`` or
``{"error": "..."}`` as JSON to stdout.
"""
from __future__ import annotations

import json
import sys
from typing import Any

PDF_SIGNATURES = (b"%PDF-1.", b"%PDF-2.", b"%PDF 1.")
_METADATA_KEYS = ("title", "author", "subject", "creator", "producer")


def is_pdf_bytes(data: bytes) -> bool:
    return data.startswith(PDF_SIGNATURES) or b"%PDF" in data[:20]


def extract_pdf(data: bytes, max_pages: int) -> dict[str, Any]:
    """Extract per-page text and metadata. Raises ValueError for invalid PDFs."""
    import pymupdf

    if not is_pdf_bytes(data):
        raise ValueError("File is not a valid PDF (bad header signature)")
    try:
        doc = pymupdf.open(stream=data, filetype="pdf")
    except Exception as e:
        raise ValueError(f"Cannot open PDF: {e}") from e

    try:
        pages = []
        char_offset = 0
        for i in range(min(len(doc), max_pages)):
            text = doc.load_page(i).get_text("text") or ""
            pages.append({"page_number": i + 1, "text": text, "char_offset": char_offset})
            char_offset += len(text)

        doc_meta = doc.metadata or {}
        metadata = {key: doc_meta[key] for key in _METADATA_KEYS if doc_meta.get(key)}
        return {"pages": pages, "metadata": metadata}
    finally:
        doc.close()


def _apply_limits(memory_limit_mb: int, cpu_seconds: int) -> None:
    try:
        import resource
    except ImportError:  # pragma: no cover - not available on Windows
        return
    memory_bytes = memory_limit_mb * 1024 * 1024
    resource.setrlimit(resource.RLIMIT_AS, (memory_bytes, memory_bytes))
    resource.setrlimit(resource.RLIMIT_CPU, (cpu_seconds, cpu_seconds))


def main() -> None:
    max_pages, memory_limit_mb, cpu_seconds = (int(arg) for arg in sys.argv[1:4])
    _apply_limits(memory_limit_mb, cpu_seconds)
    data = sys.stdin.buffer.read()
    try:
        result = extract_pdf(data, max_pages)
    except ValueError as e:
        result = {"error": str(e)}
    sys.stdout.write(json.dumps(result))


if __name__ == "__main__":
    main()
