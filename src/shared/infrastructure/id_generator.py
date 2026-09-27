from __future__ import annotations

import uuid


def generate_id() -> uuid.UUID:
    return uuid.uuid4()
