# ADR-004: openapi-typescript for end-to-end API type safety

**Status:** Proposed  
**Date:** 2026-06-02

## Decision

Use `openapi-typescript` to auto-generate TypeScript types from FastAPI's OpenAPI schema, and `openapi-fetch` + `openapi-react-query` to consume those types in the frontend.

## Context

FastAPI automatically exposes an OpenAPI schema at `/openapi.json` based on Pydantic models. Without using this, frontend developers must hand-write TypeScript interfaces that duplicate what already exists in Python — and these drift out of sync as the backend evolves. A wrong field name or type in a frontend API call produces a runtime error instead of a compile-time error.

The goal is to make backend changes automatically surface as TypeScript errors in the frontend before anyone runs the app.

## Alternatives considered

| Option | Why rejected |
| --- | --- |
| **Hand-written TypeScript interfaces** | Duplicate the Pydantic models and drift silently. Every backend change requires a matching manual frontend update with no enforcement. |
| **tRPC** | Requires the backend to be Node.js. Odysseus backend is FastAPI (Python) — incompatible. |
| **GraphQL + codegen** | Requires replacing the REST API with GraphQL. Disproportionate change for what is needed. |
| **Zod schemas shared via a package** | Requires a monorepo setup and sharing code between Python and JS runtimes — complex and fragile. |

## Consequences

- `pnpm run generate:api` regenerates `src/api/schema.ts` from the live backend at `http://localhost:7000/openapi.json`
- `schema.ts` is committed and treated as a build artifact — generated, not hand-written
- CI fails if `schema.ts` is out of sync with the backend (`git diff --exit-code src/api/schema.ts`)
- Any PR that adds or changes a backend endpoint must regenerate and commit the updated schema
- `openapi-fetch` wraps `fetch` with the generated types — every API call is type-checked at compile time
- `openapi-react-query` bridges this with TanStack Query — no hand-written `queryFn` needed
