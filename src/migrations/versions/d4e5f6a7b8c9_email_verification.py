"""email verification and evidence snapshot protection

- pending_registrations holds sign-ups until the email address is confirmed.
- users.email_verified_at records confirmation. Existing rows stay NULL and must
  confirm through /auth/resend-verification before logging in.
- verification_evidence.evidence_id no longer cascades, so the database refuses to
  delete evidence that a verification snapshot references (closes a check-then-delete race).
  The check is deferred to commit so user/claim deletion, which cascades to both
  sides, still works.
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "d4e5f6a7b8c9"
down_revision: str | None = "c3d4e5f6a7b8"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_EVIDENCE_FK = "verification_evidence_evidence_id_fkey"


def upgrade() -> None:
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

    op.add_column("users", sa.Column("email_verified_at", sa.DateTime(timezone=True), nullable=True))

    op.drop_constraint(_EVIDENCE_FK, "verification_evidence", type_="foreignkey")
    op.create_foreign_key(
        _EVIDENCE_FK,
        "verification_evidence",
        "evidence",
        ["evidence_id"],
        ["id"],
        deferrable=True,
        initially="DEFERRED",
    )


def downgrade() -> None:
    op.drop_constraint(_EVIDENCE_FK, "verification_evidence", type_="foreignkey")
    op.create_foreign_key(
        _EVIDENCE_FK, "verification_evidence", "evidence", ["evidence_id"], ["id"], ondelete="CASCADE"
    )
    op.drop_column("users", "email_verified_at")
    op.drop_index("ix_pending_registrations_expires_at", table_name="pending_registrations")
    op.drop_index("ix_pending_registrations_email", table_name="pending_registrations")
    op.drop_table("pending_registrations")
