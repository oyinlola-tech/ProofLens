from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "e5f6a7b8c9d0"
down_revision: str | None = "d4e5f6a7b8c9"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("verifications", sa.Column("source_grounded_statement", sa.Text(), nullable=True))
    op.add_column("verifications", sa.Column("why_claim_does_not_match", sa.Text(), nullable=True))
    op.add_column("verifications", sa.Column("unsupported_parts", sa.Text(), nullable=True))
    op.add_column("verifications", sa.Column("source_limitations", sa.Text(), nullable=True))
    op.add_column("verifications", sa.Column("supported_parts", sa.Text(), nullable=True))
    op.add_column("verifications", sa.Column("evidence_refs", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("verifications", "evidence_refs")
    op.drop_column("verifications", "supported_parts")
    op.drop_column("verifications", "source_limitations")
    op.drop_column("verifications", "unsupported_parts")
    op.drop_column("verifications", "why_claim_does_not_match")
    op.drop_column("verifications", "source_grounded_statement")
