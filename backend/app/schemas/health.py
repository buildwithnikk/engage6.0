"""Response schema for the health endpoint.

`database` is a closed set of three states, deliberately:
  ok           — a connection was opened and a trivial query succeeded
  unconfigured — no DATABASE_URL is set; nothing was attempted
  unavailable  — a DATABASE_URL is set but the connection or query failed

There is no fourth "assume fine" state. The endpoint never claims the database is
healthy without having checked it.
"""

from typing import Literal

from pydantic import BaseModel, Field

DatabaseStatus = Literal["ok", "unconfigured", "unavailable"]


class HealthResponse(BaseModel):
    status: Literal["ok"] = Field(description="Liveness of the API process itself.")
    version: str = Field(description="Backend application version.")
    database: DatabaseStatus = Field(
        description="Real database state. Never reports 'ok' without a successful query."
    )
    detail: str | None = Field(
        default=None,
        description=(
            "Short, non-sensitive explanation when database is not 'ok'. "
            "Never contains a connection string, credential or stack trace."
        ),
    )

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "status": "ok",
                    "version": "0.1.0",
                    "database": "unconfigured",
                    "detail": "DATABASE_URL is not set.",
                },
                {"status": "ok", "version": "0.1.0", "database": "ok", "detail": None},
            ]
        }
    }
