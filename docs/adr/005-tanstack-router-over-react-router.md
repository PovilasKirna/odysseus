# ADR-005: TanStack Router over React Router

**Status:** Proposed  
**Date:** 2026-06-02

## Decision

Use TanStack Router for client-side routing. Do not use React Router.

## Context

The frontend needs a client-side router. The two main options in the React ecosystem are React Router (dominant, battle-tested) and TanStack Router (newer, fully type-safe). The choice matters because URL state is used throughout the app — active folder in email, selected calendar, pagination in document lists — and type safety on route params and search params prevents a whole class of runtime bugs.

## Alternatives considered

| Option | Why rejected |
| --- | --- |
| **React Router v6/v7** | Route params and search params are untyped strings — accessing `params.id` returns `string \| undefined` with no compile-time guarantee it exists. Loader patterns in v7 push toward Remix-style server conventions that don't apply to this SPA. |
| **Wouter** | Minimal and lightweight, but no typed params or search params. Insufficient for an app with complex URL state (email folder, pagination, filters, calendar view). |
| **Next.js file-based routing** | Rejected at the build tool level — see ADR-002. |

## Consequences

- Route params, search params, and navigation are fully typed — passing the wrong param type is a compile error, not a runtime crash
- `nuqs` (type-safe URL search params) integrates via the TanStack Router adapter
- Routes are defined in `router.tsx` — no file-based magic, easy to follow for contributors unfamiliar with Next.js conventions
- TanStack Router and TanStack Query share the same ecosystem and team — data loading patterns integrate cleanly
