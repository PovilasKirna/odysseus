# ADR-002: Vite over Next.js for the frontend build

**Status:** Proposed  
**Date:** 2026-06-02

## Decision

Use Vite as the build tool for the React frontend. Do not use Next.js.

## Context

Odysseus is a self-hosted web app served by FastAPI as static files. It is a single-page application — the backend is the server, the frontend is always a client. There is no server-side rendering requirement and no need for a Node.js server at runtime.

The existing frontend is a single HTML file with inline JavaScript. When rebuilding it with a proper framework, the build tool choice determines the development experience, CI build time, and the complexity contributors face when setting up locally.

## Alternatives considered

| Option | Why rejected |
| --- | --- |
| **Next.js (static export)** | Adds server-side concepts (App Router, React Server Components, `use client` directives, `use server` actions) that have no application in a pure SPA served by FastAPI. These concepts add onboarding friction and confuse AI-assisted contributors who copy patterns from Next.js docs that don't apply here. |
| **Parcel** | Less ecosystem momentum, fewer contributors familiar with it, less documentation for the shadcn/ui + TanStack stack. |
| **Bun bundler** | Not 100% Node.js compatible — known edge cases that can be hard to diagnose. See discussion in #605. |
| **Webpack (CRA)** | Create React App is unmaintained. Raw Webpack config is heavy overhead for a project this size. |

## Consequences

- Routing is handled entirely client-side by TanStack Router — no file-based routing, no server routing
- No SSR or SSG — all data fetching is client-side via TanStack Query
- `frontend/dist/` is served by FastAPI as static files, identical to how `static/` works today — no deployment changes required
- Dev server starts in milliseconds; HMR is near-instant
- Contributors need no knowledge of Next.js-specific patterns
