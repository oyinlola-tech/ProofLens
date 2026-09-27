"""drop redundant rate_limits key index

The unique constraint on (key, window_start) already serves lookups by key.
"""
from collections.abc import Sequence

from alembic import op

revision: str = "c3d4e5f6a7b8"
down_revision: str | None = "b2c3d4e5f6a7"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.drop_index("ix_rate_limits_key", table_name="rate_limits")


def downgrade() -> None:
    op.create_index("ix_rate_limits_key", "rate_limits", ["key"])
