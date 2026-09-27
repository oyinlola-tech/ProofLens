from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "b2c3d4e5f6a7"
down_revision: str | None = "a1b2c3d4e5f6"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Add as nullable first so pre-existing rows can be backfilled before NOT NULL applies.
    op.add_column(
        "documents",
        sa.Column("processing_status", sa.String(20), nullable=True),
    )
    op.add_column(
        "documents",
        sa.Column("processing_error", sa.Text(), nullable=True),
    )

    # Documents created before this migration stored their content inline,
    # so they are already fully processed.
    op.execute("UPDATE documents SET processing_status = 'processed' WHERE processing_status IS NULL")

    op.alter_column(
        "documents",
        "processing_status",
        existing_type=sa.String(20),
        nullable=False,
        server_default="uploaded",
    )

    op.create_table(
        "document_pages",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "document_id",
            sa.String(36),
            sa.ForeignKey("documents.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("page_number", sa.Integer(), nullable=False),
        sa.Column("text", sa.Text(), nullable=False, server_default=""),
        sa.Column("char_offset", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("char_length", sa.Integer(), nullable=False, server_default="0"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )

    op.create_index(
        "ix_document_pages_document_id",
        "document_pages",
        ["document_id"],
    )

    op.create_index(
        "ix_document_pages_document_page",
        "document_pages",
        ["document_id", "page_number"],
    )


def downgrade() -> None:
    op.drop_index("ix_document_pages_document_page", table_name="document_pages")
    op.drop_index("ix_document_pages_document_id", table_name="document_pages")
    op.drop_table("document_pages")

    op.drop_column("documents", "processing_error")
    op.drop_column("documents", "processing_status")
