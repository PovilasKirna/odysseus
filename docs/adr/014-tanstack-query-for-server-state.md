# ADR-014: TanStack Query for server state management

**Status:** Proposed  
**Date:** 2026-06-02

## Decision

Use TanStack Query as the server state layer. All data fetched from the API lives in TanStack Query — not in Zustand, not in component state, not in a custom fetch hook.

## Context

Server state is fundamentally different from client state: it lives on the server, can become stale, needs to be re-fetched, and may be shared across multiple components simultaneously. Managing it with `useState` + `useEffect` leads to duplicated fetch logic, inconsistent loading/error states, no caching, and race conditions on fast navigation. A dedicated server state library solves all of these.

## Alternatives considered

| Option | Why rejected |
| --- | --- |
| **SWR (Vercel)** | Simpler API but more limited — no mutation support beyond manual cache invalidation, no built-in pagination helpers, no `queryKey` factory pattern. Less suitable for an app with complex mutation flows (creating a calendar event and invalidating the right queries, for example). |
| **React Query v4 (standalone)** | TanStack Query *is* React Query v5, rebranded as part of the TanStack ecosystem. Choosing TanStack Query ensures it integrates with TanStack Router's loader pattern without bridging code. |
| **Apollo Client** | GraphQL-specific. Odysseus uses a REST API. |
| **Redux Toolkit Query (RTK Query)** | Requires Redux as a peer dependency. Rejected along with Redux — see ADR-006. Overkill for what is essentially a fetch-and-cache layer. |
| **Plain `useEffect` + `useState`** | No caching, no deduplication, no background refetch, no stale-while-revalidate, manual loading/error state in every component. Does not scale past a handful of endpoints. |
| **Zustand for server data** | Zustand is for ephemeral UI state. Storing server responses in Zustand requires manual invalidation, manual loading states, and manual error handling — reimplementing what TanStack Query provides out of the box. |

## Consequences

- All API data is cached, deduplicated, and kept fresh automatically — the same query fetched from two components makes one network request
- Loading, error, and stale states are handled uniformly across the app without per-component boilerplate
- Mutations use `useMutation` + `invalidateQueries` — the cache is the source of truth, not local state
- Integrates with `openapi-react-query` (see ADR-004) to produce fully typed hooks from the generated schema — no hand-written `queryFn` or response types
- Integrates with TanStack Router (see ADR-005) for route-level data preloading
- **Hard rule:** server data never goes into Zustand or component state. If it came from an endpoint, it belongs here.
