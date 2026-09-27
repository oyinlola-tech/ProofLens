from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Generic, TypeVar

Q = TypeVar("Q", bound="Query")


@dataclass
class Query:
    """Base class for CQRS queries.

    Queries represent intent to read state.
    """

    pass


@dataclass
class QueryHandler(Generic[Q], ABC):
    """Base class for query handlers."""

    @abstractmethod
    async def handle(self, query: Q) -> object:
        ...
