# Odysseus — Architecture & Conventions

> **Scope:** Rules enforceable today in the current codebase structure.  
> **Principle:** No behavior changes without a separate PR. Structure first, features after.

---

## Current Structure

```
core/           Shared infrastructure — auth, middleware, models, constants, exceptions.
                Imported freely by routes/ and services/. Never imports from either.

routes/         HTTP layer only. One file per feature area. Handlers call into
                src/ or services/ depending on which layer that domain has reached.

src/            Flat collection of ~80 business logic modules. The majority of
                active logic lives here today (LLM core, tool execution, chat,
                agent loop, background jobs, CalDAV, email parsing, RAG, etc.).
                This is the layer being progressively migrated into services/.

services/       Organized domain subdirectories — the target home for all business
                logic. Currently contains: memory/, research/, search/, hwfit/,
                docs/, shell/, stt/, tts/, youtube/, faces/.
                Some domains have parallel implementations in src/ that have not
                yet been reconciled (see Future Direction).

mcp_servers/    Standalone MCP server implementations (email, image gen, memory,
                RAG). Treated as services — business logic lives here, not in
                the route that starts them.
```

---

## Layer Rules

### `routes/`

- Handlers do: parse request → call service → return response.
- No business logic in handlers. No database queries directly in handlers.
- Target length: ~20 lines per handler. If it's longer, the logic belongs in `services/` (or `src/` until that domain is migrated).
- New code: import only from `core/` and `services/`. Existing routes that import from `src/` are being migrated — do not add new `src/` imports to routes.

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

The following changes are proposed in [#605](https://github.com/pewdiepie-archdaemon/odysseus/issues/605) and are pending maintainer approval. **Do not implement them ahead of an explicit green light.**

### Proposed target backend structure

The goal is to eliminate `src/` entirely by migrating its modules into organized `services/` subdirectories. The proposed domain breakdown (informed by [#605 community discussion](https://github.com/pewdiepie-archdaemon/odysseus/issues/605)):

```
services/
├── llm/            llm_core, ai_interaction, model_context, model_discovery,
│                   endpoint_resolver — the LLM abstraction layer
├── agent/          agent_loop, agent_runs, prompts
├── tools/          tool_execution, tool_implementations, tool_index,
│                   tool_parsing, tool_schemas, tool_security
├── mcp/            mcp_manager, builtin_mcp — plus content from mcp_servers/
├── chat/           chat_handler, chat_processor, streaming, prompts
├── background/     bg_jobs, bg_monitor, task_scheduler, cleanup_service
├── calendar/       caldav_sync, ical parsing
├── email/          imap, smtp, triage, email_thread_parser, prompts
├── memory/         memory, memory_vector, skills — MERGE src/ + services/memory/
├── research/       research_handler, deep_research, utils — MERGE src/ + services/research/
├── search/         core, providers, query, ranking, analytics, cache, content
│                   — MERGE src/search/ + services/search/
├── documents/      document_processor, pdf_forms, pdf_runtime, rag, prompts
├── integrations/   caldav_sync, youtube_handler — external connectors
└── ...             hwfit/, shell/, stt/, tts/ stay as-is
```

Domains marked MERGE have parallel implementations in both `src/` and `services/` that need to be reconciled before the move — one canonical version must be chosen.

### Other pending items

- `routes/` → `api/` rename (after `src/` migration is complete)
- Python tooling: `uv`, `pyproject.toml`, `ruff` (replacing `requirements.txt`)
- Frontend rebuild: React + TypeScript + Vite (current app needs stabilization first)
- CI gate with branch protection on `dev`

When any of these are approved, each will land as a separate PR with its own ADR.
