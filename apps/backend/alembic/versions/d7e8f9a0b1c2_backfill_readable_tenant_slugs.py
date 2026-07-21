"""backfill readable tenant slugs

Revision ID: d7e8f9a0b1c2
Revises: c6d7e8f9a0b1
Create Date: 2026-07-21 15:30:00.000000
"""

from __future__ import annotations

import re
import unicodedata
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "d7e8f9a0b1c2"
down_revision: Union[str, None] = "c6d7e8f9a0b1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _slugify(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value or "")
    ascii_value = normalized.encode("ascii", "ignore").decode("ascii")
    slug = re.sub(r"[^a-zA-Z0-9]+", "-", ascii_value.lower()).strip("-")
    slug = re.sub(r"-{2,}", "-", slug)
    return (slug[:80] or "estudio").strip("-") or "estudio"


def upgrade() -> None:
    bind = op.get_bind()
    rows = bind.execute(
        sa.text("SELECT id, name, slug FROM tenants WHERE slug LIKE 'tenant-%' ORDER BY id")
    ).mappings().all()
    used = {
        row["slug"].lower()
        for row in bind.execute(sa.text("SELECT slug FROM tenants WHERE slug NOT LIKE 'tenant-%'")).mappings().all()
        if row["slug"]
    }
    for row in rows:
        base = _slugify(row["name"])
        candidate = base
        suffix = 2
        while candidate.lower() in used:
            suffix_text = f"-{suffix}"
            candidate = f"{base[:80 - len(suffix_text)]}{suffix_text}"
            suffix += 1
        used.add(candidate.lower())
        bind.execute(
            sa.text("UPDATE tenants SET slug = :slug WHERE id = :id"),
            {"slug": candidate, "id": row["id"]},
        )


def downgrade() -> None:
    # Data migration only. Existing readable slugs are intentionally preserved.
    pass
