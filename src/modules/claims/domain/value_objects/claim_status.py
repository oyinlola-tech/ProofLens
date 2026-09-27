from __future__ import annotations

from enum import StrEnum


class ClaimStatus(StrEnum):
    PENDING = "pending"
    ANALYZING = "analyzing"
    VERIFIED = "verified"
    REJECTED = "rejected"
    UNVERIFIED = "unverified"
    FAILED = "failed"
