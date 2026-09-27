from uuid import uuid4

from modules.documents.domain.document import Document
from modules.documents.domain.document_type import DocumentType

TEST_OWNER = uuid4()


def test_document_type_values():
    assert DocumentType.PDF == "pdf"
    assert DocumentType.TEXT == "text"
    assert DocumentType.HTML == "html"
    assert DocumentType.UNKNOWN == "unknown"


def test_document_creation():
    doc = Document.create(
        filename="test.pdf",
        owner_id=TEST_OWNER,
        document_type=DocumentType.PDF,
        content="Test content",
    )
    assert doc.filename == "test.pdf"
    assert doc.document_type == DocumentType.PDF
    assert doc.content == "Test content"
    assert doc.id is not None
