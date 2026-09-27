from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Generic, TypeVar

C = TypeVar("C", bound="Command")


@dataclass
class Command:
    """Base class for CQRS commands.

    Commands represent intent to change state.
    """

    pass


@dataclass
class CommandHandler(Generic[C], ABC):
    """Base class for command handlers."""

    @abstractmethod
    async def handle(self, command: C) -> object:
        ...
