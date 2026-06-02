# Odysseus — Architecture & Conventions

> **Scope:** Rules enforceable today in the current codebase structure.  
> **Principle:** No behavior changes without a separate PR. Structure first, features after.

---

## Current Structure

```
core/           Shared infrastructure — auth, middleware, models, constants, exceptions.
                Imported freely by routes/ and services/. Never imports from either.

routes/         HTTP layer only. One file per feature area. Handlers are thin —
                validate input, call a service, return a response.

services/       All business logic. Organized by domain. Services import from core/
                and from each other where needed. Never import from routes/.

mcp_servers/    Standalone MCP server implementations. Treated as services —
                business logic lives here, not in the route that starts them.
```

---

## Layer Rules

### `routes/`

- Handlers do: parse request → call service → return response.
- No business logic in handlers. No database queries directly in handlers.
- Target length: ~20 lines per handler. If it's longer, the logic belongs in `services/`.
- Import only from `core/` and `services/`. Never from another route file.

### `services/`

- All business logic lives here, organized by domain (`services/memory/`, `services/search/`, etc.).
- Services may import from `core/` and from other services.
- Services never import from `routes/`.
- Each service domain should have an `__init__.py` that exports its public interface.
  Other services import from the public interface, not from internal submodules.

### `core/`

- Contains shared infrastructure only: auth logic, middleware, Pydantic models, constants, exceptions.
- Has no knowledge of any domain (chat, email, calendar, etc.).
- Never imports from `routes/` or `services/`.

---

## Database

- SQLite. Models are defined and initialized in `app.py` (startup migrations via raw `CREATE TABLE` / `ALTER TABLE`).
- Every new column needs a migration function and a call at startup. No silent schema changes.
- Alembic is not used. Do not introduce it without a separate ADR and migration plan.

---

## Configuration

- Secrets live in `.env` only. Never commit `.env`.
- Read environment variables via `os.environ`. No hardcoded secrets or URLs scattered across files.
- A future step (tracked in [#605](https://github.com/pewdiepie-archdaemon/odysseus/issues/605)) will centralize config into a single `pydantic-settings` module — do not pre-empt it.

---

## Git Conventions

- **Branch naming:** `feat/<short-description>`, `fix/<short-description>`, `chore/<short-description>`
- **Commit style:** Imperative mood, present tense — `"Add CalDAV account support"` not `"Added"` or `"Adding"`
- **Reference issues:** Include the issue number in commits — `"Fix event UID collision (#519)"`
- **Target branch:** `dev` for all feature and fix PRs. Direct pushes to `main` are not accepted.
- **One PR per concern.** A PR that restructures files and adds a feature will be rejected.

---

## Testing

- **Philosophy:** Smoke tests only — not exhaustive. The goal is catching broken endpoints before they hit `main`, not 100% coverage.
- **Tool:** `pytest`. Run with `pytest tests/` before opening a PR.
- **What to test:** Route-level smoke tests that verify each API endpoint returns the expected status codes for valid and unauthenticated requests. Unit tests for pure functions where the logic is complex.
- A CI gate enforcing this on every PR is tracked in [#605](https://github.com/pewdiepie-archdaemon/odysseus/issues/605).

---

## Future Direction

The following changes are proposed in [#605](https://github.com/pewdiepie-archdaemon/odysseus/issues/605) and are pending maintainer approval. **Do not implement them ahead of an explicit green light:**

- Reorganizing `routes/` → `api/` and consolidating `services/` into a cleaner domain structure
- Python tooling: `uv`, `pyproject.toml`, `ruff` (replacing `requirements.txt`)
- Frontend rebuild: React + TypeScript + Vite (current app needs stabilization first)
- CI gate with branch protection on `dev`

When these are approved, each will land as a separate PR with its own ADR.
