# ADR-015: nuqs for URL search parameter state

**Status:** Proposed  
**Date:** 2026-06-02

## Decision

Use nuqs for managing URL search parameter state (query strings). View state that should survive a page refresh or be shareable as a link — active folder, selected item, pagination, active filters — lives in nuqs, not in component state or Zustand.

## Context

Several views in Odysseus have state that is meaningless if lost on refresh: the active email folder, the current page of search results, the selected calendar view, a document filter. This state belongs in the URL so users can bookmark it, share it, and have it restored on navigation. Managing raw URL params with `useSearchParams` from TanStack Router or the browser API is untyped and verbose.

## Alternatives considered

| Option | Why rejected |
| --- | --- |
| **TanStack Router `useSearch` directly** | Typed but requires defining search param schemas at the route level — fine for params that are route-specific, but cumbersome for params that are feature-local and don't need to be part of the route definition. nuqs works at the component level without touching the route config. |
| **Zustand** | Zustand state does not survive a page refresh and is not shareable as a URL. Wrong layer for this use case — see ADR-006. |
| **`useState` + manual `history.pushState`** | Untyped, verbose, error-prone. Every component manages serialisation and deserialisation differently. |
| **URL state library alternatives (use-query-params, etc.)** | nuqs is the most actively maintained option with first-class TanStack Router adapter support. Other libraries have limited or no TanStack Router integration. |

## Consequences

- URL search params are typed — `parseAsInteger`, `parseAsString`, `parseAsBoolean` with compile-time guarantees
- State survives refresh and is shareable as a link without any extra work
- TanStack Router adapter ensures nuqs and the router stay in sync — no double-write to the URL
- **Scope:** nuqs is for view state only (filters, pagination, selected items). It is not for server data (TanStack Query) or ephemeral UI state (Zustand).
- A component that switches between nuqs and Zustand for the same piece of state is a bug — use the decision tree in `frontend/CONTEXT.md` to pick the right layer
