# ADR-022: API design conventions

**Status:** Proposed  
**Date:** 2026-06-02

## Decision

All backend HTTP endpoints follow a consistent URL structure, use uniform JSON error shapes, and are organised into focused router files. New routes must not invent their own conventions.

## Context

The current route structure has grown organically — every contributor has used slightly different URL patterns, error response shapes, and router organisation. This makes the API surface unpredictable for frontend contributors and for AI-assisted code generation. A contributor looking at `/api/calendar/accounts` cannot reliably guess that the pattern for another resource is `/api/documents/<id>` without reading the source.

## Alternatives considered

| Option | Why rejected |
| --- | --- |
| **OpenAPI-first design (write spec, generate routes)** | Appropriate for a public API or a team with dedicated API designers. For a fast-moving self-hosted project it adds a spec-maintenance burden without clear benefit at this stage. openapi-typescript (ADR-004) generates types from the running app, which is the pragmatic middle ground. |
| **GraphQL** | Significant infrastructure cost (schema, resolvers, client). The frontend is a single app consuming a single backend — REST is the right tool. |
| **tRPC** | Type-safe RPC is compelling, but requires a TypeScript backend. The backend is Python/FastAPI and that is not changing. |

## Consequences

**URL structure:**
- All API routes are prefixed `/api/`
- Resource collections: `GET /api/<resource>` (list), `POST /api/<resource>` (create)
- Resource instances: `GET /api/<resource>/<id>` (read), `PUT /api/<resource>/<id>` (full update), `PATCH /api/<resource>/<id>` (partial update), `DELETE /api/<resource>/<id>` (delete)
- Actions that don't map to CRUD: `POST /api/<resource>/<id>/<action>` (e.g. `POST /api/calendar/accounts/<id>/sync`)
- No verbs in URL paths (no `/api/getUser`, `/api/doSync`) — actions belong on the method or the trailing action segment

**Error responses:**
- All errors return `{"error": "<message>", "detail": "<optional extended info>"}` — no other shape
- HTTP status codes are meaningful: 400 bad input, 401 unauthenticated, 403 forbidden (authenticated but not authorised), 404 not found, 422 validation error (FastAPI default), 500 unexpected server error
- `500` responses must never include stack traces, internal paths, or sensitive data — log those server-side, return a generic message to the client

**Router organisation:**
- Each resource domain gets its own router file in `routes/` (e.g. `routes/calendar_routes.py`)
- Routers are registered in `app.py` with a consistent prefix — no routes registered directly on the `app` object
- A single router file should not exceed ~300 lines — split into sub-routers if it grows beyond that

**FastAPI specifics:**
- Use `response_model=` on all route decorators — do not return raw dicts from routes that are meant to be stable API surface
- Use `Annotated` + `Depends` for shared dependencies (auth, DB session) — do not call `get_db()` or `get_current_user()` directly inside route bodies
