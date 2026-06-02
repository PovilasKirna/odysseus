# ADR-019: Platform boundary layer — isolate OS-specific behaviour behind a `platform/` adapter

**Status:** Proposed  
**Date:** 2026-06-02

## Decision

All OS-specific runtime behaviour must live behind a `platform/` adapter tree (`platform/windows/`, `platform/linux/`, `platform/macos/`). The agnostic core — `core/`, `routes/`, `services/`, and `app.py` — must contain no `os.name == "nt"` branches, no platform-conditional imports, and no target-specific file paths.

## Context

A recent commit introduced native Windows compatibility (`core/platform_compat.py`, changes to `app.py`, `src/embeddings.py`) that made platform-specific behaviour part of the shared runtime. The changes included: Windows-aware process handling, `safe_chmod`, UTF-8/BOM path handling, a Windows launcher, and `.gitattributes` line-ending policy. These are valid fixes, but as inline guards in agnostic modules they create a compounding problem: every subsequent contributor working in `app.py` or `core/` has to reason about which code paths are Windows-only, Docker-only, or POSIX-only.

Without a boundary, future packaging targets (native binaries, mobile, Docker variants) will find platform-specific assumptions embedded throughout the shared runtime, making it impossible to build clean per-platform artefacts.

## Alternatives considered

| Option | Why rejected |
| --- | --- |
| **Inline `os.name` guards (status quo)** | Already causing drift. Every new platform fix adds more branches to shared modules. Future packaging and CI matrix become harder to reason about with each addition. |
| **Separate repository per platform** | Too much overhead for a project this size. Shared logic would have to be duplicated or extracted into a third package. |
| **Feature flags / environment variables** | Pushes the platform decision to runtime configuration rather than code structure. Still leaves platform-specific logic in the shared module; just activates it differently. |
| **Full domain-driven packaging (patches/, packaging/, per-target CI)** | Appropriate if the project builds native binaries for distribution. The minimum viable version of this ADR is just the `platform/` adapter split — the full packaging pipeline is a follow-on if and when the project needs it. |

## Consequences

- A new `platform/` directory is introduced at the repo root with subdirectories for `windows/`, `linux/`, `macos/`, and `common/`
- `core/platform_compat.py` is refactored: the OS-agnostic interface stays in `core/`; the implementation details move to `platform/windows/` and `platform/posix/` modules
- `app.py` and `src/embeddings.py` are cleaned of direct `os.name` checks; they call the adapter interface instead
- CI smoke tests are organised per platform (`scripts/tests/windows/`, `scripts/tests/docker/`, `scripts/tests/linux/`) so failures map cleanly to a target
- The `.gitattributes` line-ending policy remains but must be documented explicitly so contributors on each OS understand why it exists
- This does not require binary compilation or a full packaging pipeline — the adapter boundary is a code organisation change, not a build system change
- If the project later targets native distributable binaries, the `patches/` and `packaging/` convention described in issue #715 can be layered on top of this boundary
