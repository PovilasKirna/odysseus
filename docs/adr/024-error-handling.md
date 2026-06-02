# ADR-024: Error handling — logging, client responses, and sensitive data

**Status:** Proposed  
**Date:** 2026-06-02

## Decision

Server-side errors are logged with full context (stack trace, request details, user ID). Client-facing error responses contain only a safe, generic message. Sensitive data — passwords, tokens, file paths, internal service URLs — must never appear in a response body, regardless of the HTTP status code.

## Context

The current codebase has no consistent error handling pattern. Some routes return raw Python exception messages to the client (`str(e)` in a 500 response), which leaks internal paths, dependency versions, and occasionally partial credentials. Other routes swallow exceptions silently and return a 200 with an empty result, making debugging impossible. The inconsistency means neither users nor developers get reliable signal from errors.

## Alternatives considered

| Option | Why rejected |
| --- | --- |
| **Sentry / external error tracker** | Valuable for production monitoring, but not a substitute for a documented in-code pattern. Sentry captures what the app sends — if the app sends raw exceptions to clients, Sentry doesn't fix that. Can be added later on top of this ADR. |
| **Return full error detail to clients in development mode** | A `DEBUG` env flag that toggles detailed errors sounds useful but is a footgun — self-hosted users run "development" configs in production. One environment, one error contract. |
| **Let FastAPI's default exception handler manage everything** | FastAPI's default 422 and 500 handlers are safe, but they don't cover application-level errors that are caught inside route bodies and re-raised. A custom exception handler is needed for those. |

## Consequences

**Server-side logging:**
- All unhandled exceptions are logged with `logger.exception(...)` — this captures the full stack trace automatically
- Log entries for request-level errors must include: route path, HTTP method, user ID (if authenticated), and a correlation ID (request UUID) for tracing
- Use the application logger (`logging.getLogger(__name__)`) — do not use `print()` for error reporting

**Client-facing responses:**
- `500` responses return `{"error": "An unexpected error occurred"}` — never `{"error": str(e)}` or any message containing a stack trace, file path, or dependency name
- `4xx` responses may include a descriptive message that helps the user fix their input (e.g. `"Invalid CalDAV URL format"`) but must not include internal implementation details
- FastAPI validation errors (`422`) use the default Pydantic response shape — do not override this; it is safe and well-understood

**Sensitive data:**
- Passwords, API keys, tokens, and secrets must never appear in log output or response bodies — use `[REDACTED]` in log messages that reference these fields
- File system paths (absolute paths to `data/`, user home directories, Docker volume mounts) must not appear in error responses — they reveal deployment topology
- Internal service URLs (ChromaDB, SearXNG, Ollama endpoint) must not appear in error responses to unauthenticated callers

**Custom exception types:**
- Define `OdysseusError(Exception)` as the base application exception with a `safe_message` field — route handlers catch this and return `safe_message` to the client, logging the full exception server-side
- This separates "what the user sees" from "what the developer diagnoses" without duplicating try/except blocks in every route
