"""Declarative base for SQLAlchemy models.

Models map a schema that migrations created. Nothing here ever issues DDL:
`Base.metadata.create_all()` is deliberately not called anywhere in the
application, because two sources of schema truth is how a schema stops being
reproducible. Migrations own the schema (supabase/migrations/).
"""

from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass
