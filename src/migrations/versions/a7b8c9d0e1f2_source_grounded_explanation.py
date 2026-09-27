"""source grounded explanation

- verifications gains the structured explanation (claim analysis, deterministic findings,
  validated evidence references, conclusion, analysis metadata) so a stored verification
  stays explainable without rerunning the AI provider.
- pending_registrations is dropped: registration now creates an unverified account and
  confirms it with a one-time code (otp_records).
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "a7b8c9d0e1f2"
down_revision: str | None = "f6a7b8c9d0e1"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("verifications", sa.Column("conclusion", sa.Text(), nullable=True))
    op.add_column("verifications", sa.Column("claim_analysis", sa.Text(), nullable=True))
    op.add_column("verifications", sa.Column("findings", sa.Text(), nullable=True))
    op.add_column("verifications", sa.Column("evidence_references", sa.Text(), nullable=True))
    op.add_column("verifications", sa.Column("analysis", sa.Text(), nullable=True))

    op.drop_index("ix_pending_registrations_expires_at", table_name="pending_registrations")
    op.drop_index("ix_pending_registrations_email", table_name="pending_registrations")
    op.drop_table("pending_registrations")


def downgrade() -> None:
    op.create_table(
        "pending_registrations",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("password_hash", sa.Text(), nullable=False),
        sa.Column("token_hash", sa.String(length=64), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("consumed_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("token_hash", name="pending_registrations_token_hash_key"),
    )
    op.create_index("ix_pending_registrations_email", "pending_registrations", ["email"])
    op.create_index("ix_pending_registrations_expires_at", "pending_registrations", ["expires_at"])

    op.drop_column("verifications", "analysis")
    op.drop_column("verifications", "evidence_references")
    op.drop_column("verifications", "findings")
    op.drop_column("verifications", "claim_analysis")
    op.drop_column("verifications", "conclusion")
