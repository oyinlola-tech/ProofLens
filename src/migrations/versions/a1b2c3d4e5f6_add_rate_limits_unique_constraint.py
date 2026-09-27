from collections.abc import Sequence

from alembic import op

revision: str = "a1b2c3d4e5f6"
down_revision: str | None = "9e27cee73047"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("""
        WITH deduped AS (
            SELECT MIN(id) as keep_id, key, window_start
            FROM rate_limits
            GROUP BY key, window_start
        )
        DELETE FROM rate_limits
        WHERE id NOT IN (SELECT keep_id FROM deduped)
    """)

    op.create_unique_constraint(
        "uq_rate_limits_key_window_start",
        "rate_limits",
        ["key", "window_start"],
    )


def downgrade() -> None:
    op.drop_constraint("uq_rate_limits_key_window_start", "rate_limits", type_="unique")
