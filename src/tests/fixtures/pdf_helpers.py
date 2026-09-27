from __future__ import annotations

import io

import pymupdf


def create_single_page_pdf(
    title: str = "Test Document",
    body: str = "This is test content.",
) -> bytes:
    doc = pymupdf.open()
    page = doc.new_page()
    tw = pymupdf.TextWriter(page.rect)
    font = pymupdf.Font("helv")
    tw.append((72, 72), title, font=font, fontsize=16)
    tw.append((72, 110), body, font=font, fontsize=12)
    tw.write_text(page)
    doc.set_metadata({"title": title})
    buf = io.BytesIO()
    doc.save(buf)
    doc.close()
    return buf.getvalue()


def create_multi_page_pdf(
    pages: list[dict[str, str]] | None = None,
) -> bytes:
    if pages is None:
        pages = [
            {"title": "Introduction", "body": "The earth is confirmed round by NASA."},
            {"title": "Evidence", "body": "Multiple studies confirm the earth's shape."},
            {"title": "Conclusion", "body": "The earth is definitively round."},
        ]

    doc = pymupdf.open()
    for i, p in enumerate(pages):
        page = doc.new_page()
        tw = pymupdf.TextWriter(page.rect)
        font = pymupdf.Font("helv")
        tw.append((72, 72), p["title"], font=font, fontsize=16)
        tw.append((72, 110), p["body"], font=font, fontsize=12)
        tw.write_text(page)

    doc.set_metadata({"title": "Multi-page Test"})
    buf = io.BytesIO()
    doc.save(buf)
    doc.close()
    return buf.getvalue()


def create_pdf_with_metadata(
    title: str = "Metadata Test",
    author: str = "Test Author",
    body: str = "Content with metadata.",
) -> bytes:
    doc = pymupdf.open()
    page = doc.new_page()
    tw = pymupdf.TextWriter(page.rect)
    font = pymupdf.Font("helv")
    tw.append((72, 72), body, font=font, fontsize=12)
    tw.write_text(page)
    doc.set_metadata({"title": title, "author": author})
    buf = io.BytesIO()
    doc.save(buf)
    doc.close()
    return buf.getvalue()


def create_text_file_bytes(content: str = "Plain text content.") -> bytes:
    return content.encode("utf-8")


def create_invalid_pdf_bytes() -> bytes:
    return b"%PDF-1.4 not a real pdf file content"
