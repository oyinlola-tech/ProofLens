from __future__ import annotations

from pydantic import BaseModel, Field

from modules.claims.domain.value_objects.claim_text import ClaimText


class CreateClaimRequest(BaseModel):
    text: str = Field(
        ..., min_length=1, max_length=ClaimText.MAX_LENGTH, description="Claim text to verify"
    )


class ClaimResponse(BaseModel):
    id: str
    text: str
    status: str
    created_at: str
    updated_at: str
