# ADR-012: SQLite with manual startup migrations (no Alembic)

**Status:** Accepted  
**Date:** 2026-06-02

## Decision

Use SQLite as the database. Manage schema migrations manually via raw `ALTER TABLE` statements executed at application startup. Do not use Alembic or any migration framework.

## Context

Odysseus is a self-hosted application that runs on a single machine. It needs a database that requires zero external setup, works out of the box in Docker, and doesn't require a DBA or separate service to manage. Schema changes have been handled by running `ALTER TABLE` statements in `app.py` at startup, which runs migrations automatically on every launch.

## Alternatives considered

| Option | Why rejected |
| --- | --- |
| **PostgreSQL** | Requires a separate running service, significantly more complex Docker setup, and is overkill for a single-user self-hosted app. PostgreSQL shines at concurrency and scale that Odysseus does not need at this stage. |
| **MySQL / MariaDB** | Same objections as PostgreSQL, with fewer benefits for this use case. |
| **Alembic (migration framework)** | Adds a migration runner, version table, and upgrade/downgrade commands. Valuable for teams deploying to managed databases, but adds complexity for a self-hosted app where migrations run automatically at startup. Introducing Alembic requires a migration history that doesn't exist, and a separate migration command that users must remember to run. |
| **SQLite with a different migration approach** | The startup migration pattern is already working and understood by the codebase. Changing it without a concrete need adds churn. |

## Consequences

- SQLite requires no external service — the database is a file in `data/`. Docker setup is minimal.
- Schema migrations run automatically every time the app starts — users never run a manual migration command
- Every new column or table change requires: a migration function (raw SQL), a call to that function in the startup sequence, and a check that it is idempotent (safe to run multiple times)
- This approach does not support rollbacks — a bad migration cannot be automatically reversed. Always test schema changes on a copy of `data/` before deploying.
- If Odysseus ever requires multi-instance deployment or a managed database, this decision should be revisited with a new ADR. At that point, Alembic or an equivalent becomes appropriate.
