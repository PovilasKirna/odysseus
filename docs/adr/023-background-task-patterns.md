# ADR-023: Background task and scheduler patterns

**Status:** Proposed  
**Date:** 2026-06-02

## Decision

Background tasks use FastAPI's `BackgroundTasks` for short-lived fire-and-forget work and the existing APScheduler instance for recurring or long-running tasks. Tasks must not share mutable state with request handlers. Each scheduled task must be idempotent.

## Context

Odysseus runs several background operations: CalDAV sync, document indexing, MCP server lifecycle management, and the Cookbook model download/serve pipeline. These are currently implemented with a mix of `BackgroundTasks`, `APScheduler` jobs, `threading.Thread`, and `asyncio` tasks — sometimes in the same feature. Contributors adding new background work have no reference pattern to follow, which has produced concurrency bugs (tasks holding DB sessions open, tasks that are not idempotent and produce duplicates on retry, tasks that silently swallow exceptions).

## Alternatives considered

| Option | Why rejected |
| --- | --- |
| **Celery + Redis** | Appropriate for distributed task queues. Adds two new services (Celery worker, Redis broker) to a self-hosted app that currently needs only Docker. Not justified at this scale. |
| **asyncio tasks only** | Works for I/O-bound work but Odysseus has CPU-bound tasks (document embedding, model serving). A pure asyncio approach blocks the event loop for those. |
| **Thread pool only** | Threading works but bypasses FastAPI's lifecycle management and makes it harder to reason about DB session scope. APScheduler + BackgroundTasks is already present and understood. |

## Consequences

- **Short-lived, request-triggered work** (e.g. sending a notification after a route completes): use `FastAPI BackgroundTasks`. These run in the same process after the response is sent. Keep them fast — anything over ~5 seconds should be a scheduled job instead.
- **Recurring or long-running work** (e.g. CalDAV sync, document re-indexing): use the shared `APScheduler` instance. Register jobs at startup, not dynamically inside route handlers.
- **DB session scope**: each background task must create its own `SessionLocal()` and close it when done. Do not pass a DB session from a request context into a background task — the session will be closed before the task uses it.
- **Idempotency**: every scheduled task must be safe to run twice. Use upserts instead of inserts where the task produces DB rows. Log a warning (not an error) if a task finds the work already done.
- **Exception handling**: background tasks must catch and log their own exceptions. An unhandled exception in a `BackgroundTasks` callback is silently swallowed by FastAPI — always wrap the task body in `try/except` and log to the application logger.
- **No shared mutable state**: tasks must not write to module-level variables or shared dicts that request handlers also read. Use the DB or a dedicated thread-safe queue.
- **Cancellation**: long-running APScheduler jobs that can be triggered by user action (e.g. model download) must support cancellation via a shared flag or event, not `os.kill`.
