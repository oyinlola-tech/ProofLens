from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "4edea1e3f92e"
down_revision: str | None = "722c7f3940dc"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("auth_tokens", sa.Column("token_hash", sa.String(length=64), nullable=True))
    op.add_column("auth_tokens", sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True))

    op.execute(sa.text("DELETE FROM auth_tokens"))

    op.drop_index("ix_auth_tokens_token", table_name="auth_tokens")
    op.drop_column("auth_tokens", "token")
    op.alter_column("auth_tokens", "token_hash", nullable=False)
    op.create_index("ix_auth_tokens_token_hash", "auth_tokens", ["token_hash"], unique=True)

    op.create_foreign_key(
        "fk_auth_tokens_user_id", "auth_tokens", "users",
        ["user_id"], ["id"], ondelete="CASCADE",
    )
    op.create_foreign_key(
        "fk_claims_owner_id", "claims", "users",
        ["owner_id"], ["id"], ondelete="CASCADE",
    )
    op.create_foreign_key(
        "fk_documents_owner_id", "documents", "users",
        ["owner_id"], ["id"], ondelete="CASCADE",
    )

    op.alter_column(
        "users", "password_hash",
        existing_type=sa.VARCHAR(length=64),
        type_=sa.Text(),
        existing_nullable=False,
    )


def downgrade() -> None:
    op.alter_column(
        "users", "password_hash",
        existing_type=sa.Text(),
        type_=sa.VARCHAR(length=64),
        existing_nullable=False,
    )
    op.drop_constraint("fk_documents_owner_id", "documents", type_="foreignkey")
    op.drop_constraint("fk_claims_owner_id", "claims", type_="foreignkey")
    op.drop_constraint("fk_auth_tokens_user_id", "auth_tokens", type_="foreignkey")

    op.add_column(
        "auth_tokens",
        sa.Column("token", sa.VARCHAR(length=64), autoincrement=False, nullable=True),
    )
    op.drop_index("ix_auth_tokens_token_hash", table_name="auth_tokens")
    op.create_index("ix_auth_tokens_token", "auth_tokens", ["token"], unique=True)
    op.drop_column("auth_tokens", "token_hash")
    op.drop_column("auth_tokens", "revoked_at")
