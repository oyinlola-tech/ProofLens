from __future__ import annotations

from uuid import uuid4

from modules.documents.domain.document_page import DocumentPage
from modules.documents.infrastructure.retrieval import (
    _compute_overlap_score,
    _normalize_text,
    _tokenize,
    retrieve_passages,
)


def _make_page(doc_id: str, page_number: int, text: str) -> DocumentPage:
    return DocumentPage.create(
        document_id=uuid4(),
        page_number=page_number,
        text=text,
        char_offset=0,
    )


class TestNormalizeText:
    def test_lowercase(self) -> None:
        assert _normalize_text("HELLO World") == "hello world"

    def test_remove_punctuation(self) -> None:
        assert _normalize_text("hello, world!") == "hello world"

    def test_collapse_whitespace(self) -> None:
        assert _normalize_text("hello   world") == "hello world"


class TestTokenize:
    def test_basic_tokenization(self) -> None:
        tokens = _tokenize("The earth is round")
        assert "earth" in tokens
        assert "round" in tokens

    def test_skip_short_words(self) -> None:
        tokens = _tokenize("a is an")
        assert len(tokens) == 0

    def test_empty_text(self) -> None:
        assert _tokenize("") == []


class TestComputeOverlapScore:
    def test_perfect_overlap(self) -> None:
        score = _compute_overlap_score(["hello", "world"], ["hello", "world", "foo"])
        assert score == 1.0

    def test_no_overlap(self) -> None:
        score = _compute_overlap_score(["hello", "world"], ["foo", "bar"])
        assert score == 0.0

    def test_partial_overlap(self) -> None:
        score = _compute_overlap_score(["hello", "world"], ["hello", "baz"])
        assert score == 0.5

    def test_empty_query(self) -> None:
        score = _compute_overlap_score([], ["hello"])
        assert score == 0.0


class TestRetrievePassages:
    def test_finds_relevant_pages(self) -> None:
        doc_id = uuid4()
        pages = [
            DocumentPage.create(doc_id, 1, "The earth is round and orbits the sun.", 0),
            DocumentPage.create(doc_id, 2, "Python is a programming language.", 50),
            DocumentPage.create(doc_id, 3, "The earth has one moon.", 100),
        ]
        result = retrieve_passages("earth round", pages)
        assert result.has_results
        assert len(result.passages) >= 1
        page_nums = [p.page_number for p in result.passages]
        assert 1 in page_nums

    def test_empty_pages(self) -> None:
        result = retrieve_passages("query", [])
        assert not result.has_results

    def test_empty_query(self) -> None:
        doc_id = uuid4()
        pages = [DocumentPage.create(doc_id, 1, "Some text.", 0)]
        result = retrieve_passages("", pages)
        assert not result.has_results

    def test_irrelevant_pages_not_returned(self) -> None:
        doc_id = uuid4()
        pages = [
            DocumentPage.create(doc_id, 1, "Quantum mechanics is complex.", 0),
        ]
        result = retrieve_passages("earth climate", pages, min_score=0.1)
        assert not result.has_results

    def test_max_results_limit(self) -> None:
        doc_id = uuid4()
        pages = [
            DocumentPage.create(doc_id, i, f"The earth topic number {i}.", 0)
            for i in range(1, 20)
        ]
        result = retrieve_passages("earth", pages, max_results=3)
        assert len(result.passages) <= 3

    def test_relevant_page_ranked_higher(self) -> None:
        doc_id = uuid4()
        pages = [
            DocumentPage.create(doc_id, 1, "Python is great.", 0),
            DocumentPage.create(doc_id, 2, "The earth is round and blue.", 50),
        ]
        result = retrieve_passages("earth round", pages)
        assert result.passages[0].page_number == 2

    def test_page_number_preserved(self) -> None:
        doc_id = uuid4()
        pages = [DocumentPage.create(doc_id, 7, "Page seven content about earth.", 0)]
        result = retrieve_passages("earth", pages)
        assert result.passages[0].page_number == 7

    def test_score_in_result(self) -> None:
        doc_id = uuid4()
        pages = [DocumentPage.create(doc_id, 1, "The earth is round.", 0)]
        result = retrieve_passages("earth", pages)
        assert result.passages[0].score > 0

    def test_document_id_preserved(self) -> None:
        doc_id = uuid4()
        pages = [DocumentPage.create(doc_id, 1, "Test document.", 0)]
        result = retrieve_passages("test document", pages)
        assert result.passages[0].document_id == doc_id
