# Python type-checking backlog

This document records the baseline type-error count when basedpyright was first introduced (ADR-011) and maps out the fix plan. It exists so contributors know the backlog is intentional — not ignored — and so each cleanup wave can close discrete items rather than hunting in the dark.

**Baseline run:** 2026-06-02 · basedpyright standard mode · Python 3.12  
**Total:** 2278 errors, 1 warning

---

## Error breakdown by rule

| Count | Rule | What it means |
|------:|------|---------------|
| 877 | `reportArgumentType` | Wrong type passed to a function parameter |
| 441 | `reportCallIssue` | Called with wrong keyword args (mostly ORM constructors) |
| 433 | `reportAttributeAccessIssue` | Attribute accessed on a type that doesn't have it |
| 234 | `reportGeneralTypeIssues` | SQLAlchemy `Column[T]` used in boolean/operator context |
| 161 | `reportOptionalMemberAccess` | Member access on a value that could be `None` |
|  29 | `reportMissingImports` | Optional dependency not installed in dev env |
|  19 | `reportOptionalSubscript` | `[]` on a possibly-`None` value |
|  18 | `reportOperatorIssue` | Operator applied to incompatible types |
|  17 | `reportReturnType` | Return value doesn't match declared return annotation |
|  16 | `reportPossiblyUnboundVariable` | Variable used before guaranteed assignment |
|   8 | `reportAssignmentType` | Assigned value doesn't match annotated type |
|   5 | `reportUndefinedVariable` | Name not defined in scope |
|   5 | `reportIncompatibleMethodOverride` | Override doesn't match base class signature |

## Top files by error count

| Errors | File |
|-------:|------|
| 220 | `task_scheduler.py` |
| 180 | `tests/test_agent_loop.py` |
| 146 | `tool_implementations.py` |
| 120 | `task_routes.py` |
|  95 | `document_routes.py` |
|  90 | `gallery_routes.py` |
|  83 | `email_routes.py` |
|  68 | `calendar_routes.py` |
|  66 | `model_routes.py` |
|  52 | `mcp_routes.py` |
|  49 | `session_manager.py` |
|  46 | `shell_routes.py` |
|  45 | `note_routes.py` |
|  43 | `diffusion_server.py` |
|  36 | `assistant_routes.py` |
|  34 | `compare_routes.py` |
|  34 | `memory_vector.py` |

---

## Root-cause clusters

These 2278 errors are not 2278 independent bugs. They collapse into five patterns — fixing one pattern in the right place eliminates hundreds of downstream errors.

### Cluster 1 — SQLAlchemy `Column[T]` used as plain `T` (~400 errors)

ORM models use pre-2.0 style column declarations (`Column(String)`) instead of modern `Mapped[T]` annotations. basedpyright sees the attribute type as `Column[str]`, not `str`, so every use of that attribute in a string context or boolean expression fails.

```python
# before
class User(Base):
    name = Column(String)

# after (SQLAlchemy 2.x mapped_column)
class User(Base):
    name: Mapped[str] = mapped_column(String)
```

Fixing the model definitions propagates the fix to every file that queries them.

### Cluster 2 — `str | None` passed where `str` is required (~250 errors)

Route handlers and service functions receive values that might be `None` (optional query params, nullable DB columns, dict `.get()` calls) and pass them directly to functions that don't accept `None`.

```python
# before — user_id could be None
send_email(to=request.user_id)

# after — narrow first
user_id = request.user_id
if user_id is None:
    raise HTTPException(400, "user_id required")
send_email(to=user_id)
```

### Cluster 3 — Keyword-arg mismatches on ORM constructors (~100 errors)

Same root cause as cluster 1. Without `Mapped[T]` annotations, pyright can't infer the constructor's keyword args, so `User(name="Alice", email="...")` reports "No parameter named 'name'".

Resolved automatically when cluster 1 is fixed (models migrated to `mapped_column`).

### Cluster 4 — `bytes` vs `str` in IMAP calls (~40 errors in `mcp_servers/email_server.py`)

The IMAP library returns `bytes` UIDs; the MCP email server passes them to functions typed as `str`. Decode at the boundary:

```python
uid_str = uid_bytes.decode() if isinstance(uid_bytes, bytes) else uid_bytes
```

### Cluster 5 — Missing imports for optional dependencies (29 errors)

`faster-whisper`, `duckduckgo-search`, `PyMuPDF`, and `markitdown` are optional (see `pyproject.toml [project.optional-dependencies]`). Their imports are not guarded, so basedpyright can't resolve them in a plain `uv sync` dev environment.

```python
# before
import faster_whisper

# after — guard with TYPE_CHECKING or lazy import
from typing import TYPE_CHECKING
if TYPE_CHECKING:
    import faster_whisper
```

---

## Fix plan

Each wave is a standalone PR — no wave blocks merging other work.

| Wave | Scope | Fixes clusters | Est. errors eliminated |
|------|-------|---------------|------------------------|
| **1** | Migrate all ORM models to `Mapped[T]` + `mapped_column` | 1, 3 | ~500 |
| **2** | Add null-checks / narrowing in route handlers | 2 | ~250 |
| **3** | `bytes.decode()` at IMAP boundary in `email_server.py` | 4 | ~40 |
| **4** | Guard optional-dep imports with `TYPE_CHECKING` | 5 | ~29 |
| **5** | Fix remaining one-off errors (return types, unbound vars, overrides) | — | ~100 |
| **6** | Enable basedpyright in CI and add to pre-commit | — | — |

Wave 6 (CI enforcement) should not land until the error count is zero or all remaining errors are explicitly suppressed with `# type: ignore[<rule>]` and a comment explaining why.

---

## Running the checker

```bash
# full check
uv run basedpyright

# single file
uv run basedpyright routes/task_routes.py
```

The VS Code extension (`ms-pyright.basedpyright`) provides the same checks inline — install it instead of Pylance. Works in Cursor, Windsurf, and VS Codium too.
