from __future__ import annotations

from dataclasses import dataclass, field

from shared.domain.domain_event import DomainEvent
from shared.domain.entity import Entity


@dataclass
class AggregateRoot(Entity):
    """Base class for aggregate roots.

    An aggregate root is the entry point to an aggregate.
    It collects domain events that can be dispatched after persistence.
    """

    _events: list[DomainEvent] = field(default_factory=list, repr=False)

    def collect_event(self, event: DomainEvent) -> None:
        self._events.append(event)

    def collect_events(self, events: list[DomainEvent]) -> None:
        self._events.extend(events)

    def pull_events(self) -> list[DomainEvent]:
        events = list(self._events)
        self._events.clear()
        return events
