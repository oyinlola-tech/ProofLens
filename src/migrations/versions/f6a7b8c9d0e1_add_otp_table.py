from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "f6a7b8c9d0e1"
down_revision: str | None = "e5f6a7b8c9d0"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "otp_records",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("user_id", sa.String(length=36), nullable=True),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("otp_hash", sa.String(length=128), nullable=False),
        sa.Column("purpose", sa.String(length=50), nullable=False, server_default="email_verification"),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("attempts", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_otp_records_user_id", "otp_records", ["user_id"])
    op.create_index("ix_otp_records_email", "otp_records", ["email"])
    op.create_index("ix_otp_records_expires_at", "otp_records", ["expires_at"])


def downgrade() -> None:
    op.drop_index("ix_otp_records_expires_at", table_name="otp_records")
    op.drop_index("ix_otp_records_email", table_name="otp_records")
    op.drop_index("ix_otp_records_user_id", table_name="otp_records")
    op.drop_table("otp_records")
