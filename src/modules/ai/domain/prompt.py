from __future__ import annotations

import re
from dataclasses import dataclass, field

from shared.domain.value_object import ValueObject

_PLACEHOLDER = re.compile(r"\{(\w+)\}")


@dataclass(frozen=True)
class Prompt(ValueObject):
    template: str
    variables: dict[str, str] = field(default_factory=dict)
    system: str | None = None

    def render(self) -> str:
        # Single pass, so placeholder-like text inside a substituted value
        # (e.g. evidence containing "{claim}") is never expanded.
        return _PLACEHOLDER.sub(
            lambda m: self.variables.get(m.group(1), m.group(0)), self.template
        )

    def __hash__(self) -> int:
        return hash((self.template, tuple(sorted(self.variables.items())), self.system))
