# Odysseus — Architecture & Implementation Document

> **Status:** v3 — updated with community feedback from #605  
> **Scope:** Backend reorganization, frontend rebuild, tooling standardization, contributor conventions  
> **Principle:** No behavior changes in Phase 1. Structure first, features after.

---

## Table of Contents

1. [Motivation](#motivation)
2. [Backend](#backend)
3. [Frontend](#frontend)
4. [State Architecture](#state-architecture)
5. [TanStack Query Conventions](#tanstack-query-conventions)
6. [Tooling](#tooling)
7. [Testing](#testing)
8. [Rules & Conventions](#rules--conventions)
9. [Context Files & ADRs](#context-files--adrs)
10. [Migration Strategy](#migration-strategy)
11. [E2E Tests](#e2e-tests)
12. [Future Work](#future-work)

---

## Motivation

Odysseus grew faster than its structure. After the initial surge of contributors, the codebase has three overlapping directories for business logic (`src/`, `services/`, `routes/`), a frontend that lives in a single HTML file with no bundler or type safety, and no enforced standards for where new code goes. The result is that contributors spend more time figuring out where to put things than writing the things themselves.

This document defines the target structure, the agreed tooling, and the rules that make it maintainable at scale.

---

## Backend

### Directory Structure

```tree
backend/
├── app.py                  # FastAPI entry point — mounts routers, sets up middleware
├── core/                   # Shared infrastructure. Imported by api/ and services/.
│   ├── auth.py             # Auth middleware, session handling, token validation
│   ├── config.py           # Settings loaded from env / .env file (pydantic-settings)
│   ├── database.py         # SQLAlchemy engine, Base, SessionLocal, all models
│   └── middleware.py       # CORS, request logging, error handling
├── api/                    # HTTP layer only. Handlers are thin — validate input,
│   │                       # call a service, return a response. No business logic here.
│   ├── calendar.py
│   ├── chat.py
│   ├── email.py
│   ├── agent.py
│   ├── memory.py
│   ├── documents.py
│   ├── auth.py
│   ├── cookbook.py
│   ├── notes.py
│   ├── search.py
│   └── settings.py
└── services/               # All business logic. One subdirectory per domain.
    ├── llm/                # LLM abstraction layer — all model I/O goes through here.
    │   ├── __init__.py
    │   ├── core.py         # was src/llm_core.py
    │   ├── interaction.py  # was src/ai_interaction.py
    │   ├── model_context.py
    │   ├── model_discovery.py
    │   └── endpoint_resolver.py
    ├── agent/
    │   ├── __init__.py
    │   ├── loop.py
    │   ├── runs.py
    │   └── prompts.py
    ├── tools/              # Tool execution — extracted from agent/ for clarity.
    │   ├── __init__.py
    │   ├── execution.py
    │   ├── implementations.py
    │   ├── index.py
    │   ├── parsing.py
    │   ├── schemas.py
    │   └── security.py
    ├── mcp/                # MCP server management + built-in servers.
    │   ├── __init__.py
    │   ├── manager.py
    │   ├── builtin.py
    │   ├── email_server.py
    │   ├── image_gen_server.py
    │   ├── memory_server.py
    │   └── rag_server.py
    ├── chat/
    │   ├── __init__.py
    │   ├── handler.py      # was src/chat_handler.py
    │   ├── processor.py    # was src/chat_processor.py
    │   ├── streaming.py
    │   └── prompts.py
    ├── background/         # Async job layer — scheduler, monitor, cleanup.
    │   ├── __init__.py
    │   ├── jobs.py         # was src/bg_jobs.py
    │   ├── monitor.py      # was src/bg_monitor.py
    │   ├── scheduler.py    # was src/task_scheduler.py
    │   └── cleanup.py      # was src/cleanup_service.py
    ├── calendar/
    │   ├── __init__.py
    │   ├── caldav_sync.py
    │   ├── ical_parser.py
    │   └── scheduler.py
    ├── email/
    │   ├── __init__.py
    │   ├── imap.py
    │   ├── smtp.py
    │   ├── triage.py
    │   ├── thread_parser.py
    │   └── prompts.py
    ├── memory/             # MERGE: src/memory*.py + services/memory/ → canonical here.
    │   ├── __init__.py
    │   ├── memory.py
    │   ├── vector.py
    │   ├── skills.py
    │   └── prompts.py
    ├── research/           # MERGE: src/deep_research.py + services/research/ → canonical here.
    │   ├── __init__.py
    │   ├── handler.py
    │   └── utils.py
    ├── search/             # MERGE: src/search/ + services/search/ → canonical here.
    │   ├── __init__.py
    │   ├── core.py
    │   ├── providers.py
    │   ├── query.py
    │   ├── ranking.py
    │   ├── analytics.py
    │   ├── cache.py
    │   └── content.py
    ├── documents/
    │   ├── __init__.py
    │   ├── parser.py
    │   ├── pdf_forms.py    # was src/pdf_forms.py + pdf_form_doc.py
    │   ├── pdf_runtime.py
    │   ├── rag.py
    │   └── prompts.py
    ├── integrations/       # External connectors — CalDAV, YouTube, etc.
    │   ├── __init__.py
    │   ├── caldav.py
    │   └── youtube.py      # MERGE: src/youtube_handler.py + services/youtube/
    ├── cookbook/
    │   ├── __init__.py
    │   ├── hwfit.py
    │   └── serve.py
    └── shell/              # shell/, stt/, tts/, faces/ stay as-is.
        └── ...
```

> **MERGE domains** (memory, research, search, integrations): both `src/` and `services/` currently have overlapping implementations. Before moving files, one canonical version must be chosen and the other deleted. This is a prerequisite for Phase 1 — do not move files until the merge is resolved.

### Layer Rules

**`core/`**

- Contains shared infrastructure only: database models, auth logic, config, middleware.
- Has no knowledge of any domain (chat, email, calendar, etc.).
- Imported freely by `api/` and `services/`. Never imports from either.

**`api/`**

- Route handlers only. Each file maps 1:1 to a FastAPI router.
- Handlers do: parse request → call service → return response.
- No database queries directly in handlers. No business logic.
- Maximum handler length: ~20 lines. If it's longer, the logic belongs in `services/`.

**`services/`**

- All business logic lives here, organized by domain.
- Services import from `core/` (database, config) and from each other where needed.
- Services never import from `api/`.
- Each domain folder has an `__init__.py` that exports its public interface.
  Other services import from the public interface, not from internal submodules.

### Database

- All SQLAlchemy models defined in `core/database.py`.
- At-startup migrations via raw SQLite `ALTER TABLE` (existing pattern — keep it).
- Alembic is not used; do not introduce it without a separate discussion.
- Model field additions always include a migration function and a call in `init_db()`.

### Configuration

- All config loaded via `pydantic-settings` in `core/config.py`.
- A single `Settings` instance imported wherever needed. No `os.environ.get()` scattered across files.
- `.env` is the only place secrets live. Never commit it.

---

## Frontend

### Technology Stack

> **Note:** This stack reflects what has worked well in production across multiple projects and stacks up cleanly together — all tools are well-documented, actively maintained, and play nicely with each other and with LLM-assisted development. It is open for discussion, but the priority is to move forward and rebuild the app for long-term maintainability rather than relitigating the stack indefinitely. If you have a strong reason to swap a specific tool, open a focused issue rather than blocking the overall effort.

| Layer | Tool | Why |
| --- | --- | --- |
| Build | **Vite** | Fast dev server, minimal config, standard for React + TS apps |
| Framework | **React 19 + TypeScript** | Industry standard, massive ecosystem, LLMs are excellent at it |
| Components | **shadcn/ui** | Unstyled-by-default, copy-into-repo model — full control, no version lock |
| Routing | **TanStack Router** | Fully type-safe routes, params, and search params |
| Server state | **TanStack Query** | Fetch, cache, and sync all server data |
| Client state | **Zustand** | Minimal, no boilerplate, for ephemeral UI state only |
| URL state | **nuqs** | Type-safe URL search params, TanStack Router adapter |
| API types | **openapi-typescript** | Auto-generates TypeScript types from FastAPI's OpenAPI schema — end-to-end type safety from Python to React |
| Package manager | **pnpm** | Faster installs, strict dependency isolation, blocks install scripts by default (supply chain security) |
| Lint/format | **Biome** | Replaces ESLint + Prettier in one fast Rust tool |

### Directory Structure

```tree
frontend/
├── src/
│   ├── main.tsx                # React entry point
│   ├── router.tsx              # TanStack Router root definition
│   │
│   ├── components/             # Shared reusable components
│   │   ├── ui/                 # shadcn/ui generated components (auto-managed, do not edit)
│   │   ├── layout/             # App shell: sidebar, topbar, nav
│   │   └── common/             # Shared non-ui components: ErrorBoundary, Spinner, etc.
│   │
│   ├── pages/                  # One folder per major view
│   │   ├── chat/
│   │   │   ├── index.tsx       # Page component (route entry point)
│   │   │   ├── MessageList.tsx
│   │   │   ├── InputBar.tsx
│   │   │   └── SessionSidebar.tsx
│   │   ├── calendar/
│   │   ├── email/
│   │   ├── agent/
│   │   ├── memory/
│   │   ├── documents/
│   │   ├── notes/
│   │   ├── settings/
│   │   └── cookbook/
│   │
│   ├── api/                    # Typed API layer — generated schema + domain query hooks
│   │   ├── schema.ts           # AUTO-GENERATED by openapi-typescript — do not edit
│   │   ├── client.ts           # openapi-fetch client instance (auth headers, base URL)
│   │   ├── calendar.ts         # TanStack Query hooks for calendar endpoints
│   │   ├── chat.ts
│   │   ├── email.ts
│   │   └── ...
│   │
│   ├── store/                  # Zustand stores — client UI state only
│   │   ├── ui.ts               # Sidebar open/closed, active modal, theme
│   │   └── session.ts          # Current user session info
│   │
│   ├── hooks/                  # Custom React hooks
│   │   ├── useCalendar.ts      # TanStack Query hooks for calendar data
│   │   ├── useChat.ts
│   │   └── ...
│   │
│   └── lib/                    # Pure utility functions, no React
│       ├── dates.ts
│       ├── formatting.ts
│       └── constants.ts
│
├── index.html
├── vite.config.ts
├── tsconfig.json
└── biome.json
```

### Theme

**Base theme: zinc** — neutral gray scale, works for both light and dark modes, closest to Odysseus's current dark aesthetic without over-committing to a color. Set once via `shadcn init` and not changed without a coordinated design discussion.

shadcn/ui uses CSS custom properties for all colors. The full token set lives in `index.css`:

```css
@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 240 10% 3.9%;
    --primary: 240 5.9% 10%;
    /* ... */
  }
  .dark {
    --background: 240 10% 3.9%;
    --foreground: 0 0% 98%;
    --primary: 0 0% 98%;
    /* ... */
  }
}
```

#### Migrating Odysseus Themes to shadcn Variants

Odysseus currently ships multiple color themes (dark mode variants with different accent colors — red, purple, blue, etc.) controlled via CSS variables on the `body` element. These map cleanly onto shadcn's token system.

**Migration approach:**

1. Map each existing Odysseus CSS variable to the closest shadcn token:

   | Odysseus variable | shadcn token |
   | --- | --- |
   | `--bg` | `--background` |
   | `--fg` | `--foreground` |
   | `--accent` | `--primary` |
   | `--border` | `--border` |
   | `--red` | `--destructive` |
   | `--green` | *(custom, keep as-is)* |

2. Each Odysseus theme becomes a CSS class that overrides shadcn tokens:

   ```css
   /* Default: zinc dark (matches shadcn .dark) */
   /* Accent variants — applied via <html data-theme="purple"> */

   [data-theme="purple"] {
     --primary: 270 60% 60%;
     --primary-foreground: 0 0% 100%;
     --ring: 270 60% 60%;
   }

   [data-theme="blue"] {
     --primary: 217 91% 60%;
     --primary-foreground: 0 0% 100%;
     --ring: 217 91% 60%;
   }
   ```

3. The theme selector in Settings writes `data-theme` to `<html>` and persists the choice in Zustand + `localStorage`.

4. All shadcn components automatically pick up the correct colors via the token system — no per-component color overrides needed.

This preserves every existing Odysseus theme while making them first-class citizens in the new design system.

---

### Build Output

Vite compiles `frontend/src/` to `frontend/dist/`. FastAPI serves `frontend/dist/` as a static mount — identical to how it serves `static/` today. No deployment changes required.

```python
# app.py
from fastapi.staticfiles import StaticFiles
app.mount("/", StaticFiles(directory="frontend/dist", html=True), name="frontend")
```

### API Type Generation

FastAPI automatically exposes an OpenAPI schema at `/openapi.json`. `openapi-typescript` reads that schema and generates a `schema.ts` file with full TypeScript types for every request and response. `openapi-fetch` (from the same team) wraps `fetch` with those types so every API call is fully typed end-to-end — from the Python Pydantic model all the way to the React component.

```text
Python Pydantic model → FastAPI /openapi.json → openapi-typescript → schema.ts → openapi-fetch client → TanStack Query hook → React component
```

**Setup:**

```ts
// src/api/client.ts
import createClient from 'openapi-fetch';
import type { paths } from './schema'; // auto-generated

export const apiClient = createClient<paths>({ baseUrl: '/' });
```

```ts
// src/api/calendar.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from './client';

export function useCalendarAccounts() {
  return useQuery({
    queryKey: ['calendar', 'accounts'],
    queryFn: async () => {
      const { data, error } = await apiClient.GET('/api/calendar/accounts');
      if (error) throw error;
      return data;
    },
  });
}
```

**Regenerating types** — run whenever the backend changes:

```bash
pnpm run generate:api
# which runs: openapi-typescript http://localhost:7000/openapi.json -o src/api/schema.ts
```

Add this to CI so a stale schema breaks the build:

```yaml
- run: pnpm run generate:api
  working-directory: frontend
- run: git diff --exit-code src/api/schema.ts  # fail if schema is out of sync
```

`schema.ts` is committed to the repo and treated as a build artifact — generated, not hand-written. Any PR that changes a backend endpoint must regenerate and commit the updated schema.

---

## State Architecture

Understanding which state layer to use is the most important decision when writing frontend code.

### Decision Tree

```text
Is the data fetched from the server?
  YES → TanStack Query (useQuery / useMutation)

Is it state that should survive a page refresh or be shareable as a URL?
  YES → nuqs (useQueryState)

Is it ephemeral UI state (open/closed, selected tab, modal visible)?
  YES → Zustand

Is it local to a single component?
  YES → useState / useReducer
```

### TanStack Query — Server State

All API data lives here. Never store server responses in Zustand.

```typescript
// hooks/useCalendar.ts
export function useCalendars() {
  return useQuery({
    queryKey: ['calendars'],
    queryFn: () => api.calendar.list(),
  });
}

export function useCreateEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.calendar.createEvent,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['calendars'] }),
  });
}
```

### nuqs — URL State

View state that should survive refresh or be sharable.

```typescript
// pages/email/index.tsx
const [folder, setFolder] = useQueryState('folder', parseAsString.withDefault('inbox'));
const [page, setPage] = useQueryState('page', parseAsInteger.withDefault(1));
```

### Zustand — Client UI State

Ephemeral state with no server equivalent.

```typescript
// store/ui.ts
interface UIStore {
  sidebarOpen: boolean;
  activeModal: string | null;
  toggleSidebar: () => void;
  openModal: (id: string) => void;
  closeModal: () => void;
}

export const useUIStore = create<UIStore>((set) => ({
  sidebarOpen: true,
  activeModal: null,
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  openModal: (id) => set({ activeModal: id }),
  closeModal: () => set({ activeModal: null }),
}));
```

### TanStack Router — Routing

All routes are defined in `router.tsx` and are fully typed. No string-based route access.

```typescript
// router.tsx
const rootRoute = createRootRoute({ component: RootLayout });
const chatRoute = createRoute({ getParentRoute: () => rootRoute, path: '/chat' });
const calendarRoute = createRoute({ getParentRoute: () => rootRoute, path: '/calendar' });

export const router = createRouter({
  routeTree: rootRoute.addChildren([chatRoute, calendarRoute, ...]),
});
```

---

## TanStack Query Conventions

TanStack Query is flexible enough that two developers can use it in completely different ways and both be "correct." Without agreed conventions, the codebase ends up with a mix of raw `fetch()` calls, hand-typed responses, magic string query keys, and inconsistent error handling. These five conventions prevent that.

### The Library Chain

Three libraries work together, each with a distinct job:

| Library | Job |
| --- | --- |
| **openapi-typescript** | Reads FastAPI's `/openapi.json` and generates `schema.ts` — TypeScript types for every endpoint, request, and response |
| **openapi-fetch** | Typed `fetch` wrapper — every request is checked against `schema.ts` at compile time |
| **openapi-react-query** | Bridges openapi-fetch with TanStack Query — produces typed `useQuery` and `useMutation` hooks so you never write a `queryFn` by hand |

Result: if a backend endpoint changes, the TypeScript compiler tells you exactly what broke before you run the app.

### Convention 1 — One typed client, used everywhere

A single `apiClient` instance lives in `src/api/client.ts`. All middleware (auth, error handling) is wired here. All domain files import their hooks from this file — never directly from `@tanstack/react-query` or `openapi-react-query`.

```typescript
// src/api/client.ts
import createFetchClient from 'openapi-fetch';
import createClient from 'openapi-react-query';
import type { paths } from './schema'; // auto-generated, do not edit

const fetchClient = createFetchClient<paths>({ baseUrl: '/' });

fetchClient.use({
  async onResponse({ response }) {
    if (response.status === 401) window.location.reload();
    if (response.status === 403) toast.error('Access denied');
    if (!response.ok) {
      const err = new Error(`HTTP ${response.status}`);
      throw Object.assign(err, { status: response.status });
    }
  },
});

const { queryOptions, useQuery, useSuspenseQuery, useMutation } =
  createClient(fetchClient);

export { queryOptions, useQuery, useSuspenseQuery, useMutation };
```

**Rule:** Import `useQuery` and `useMutation` from `src/api/client.ts`, not from `@tanstack/react-query`.

### Convention 2 — Query key factories per domain

Each domain has a `*Queries` object that defines all its queries in one place. The factory functions return a complete `queryOptions` object — key, fetch function, and per-query config. Components never write raw query key arrays.

```typescript
// src/api/calendar.ts
import { queryOptions } from './client';

export const calendarQueries = {
  accounts: () =>
    queryOptions('get', '/api/calendar/accounts'),

  events: (start: string, end: string) =>
    queryOptions('get', '/api/calendar/events', {
      params: { query: { start, end } },
    }),

  account: (id: string) =>
    queryOptions('get', '/api/calendar/accounts/{account_id}', {
      params: { path: { account_id: id } },
    }),
};
```

**Why:** If an endpoint changes, fix it in one place and TypeScript surfaces every broken callsite. Invalidation uses `.queryKey` accessors — never magic strings.

### Convention 3 — Custom hooks for business logic

If a component needs more than a raw query result — normalizing a response shape, combining queries, deriving computed values — that logic goes into a custom hook in `src/hooks/`. Components call the hook and get clean data back.

```typescript
// src/hooks/useCalendarAccounts.ts
import { useQuery } from '../api/client';
import { calendarQueries } from '../api/calendar';

export function useCalendarAccounts() {
  const { data, isPending, error } = useQuery(calendarQueries.accounts());
  return { accounts: data?.accounts ?? [], isPending, error };
}
```

**Rule:** Components that need more than one line of query logic get a custom hook. Raw `useQuery` in a component is fine only when the result is used as-is with no transformation.

### Convention 4 — Mutations inline, invalidation uses factory keys

Mutations are defined inline in the component that triggers them. After a successful mutation, invalidate affected queries using the factory's `.queryKey` accessor — never a hand-written string.

```typescript
import { useMutation } from '../api/client';
import { calendarQueries } from '../api/calendar';
import { useQueryClient } from '@tanstack/react-query';

function AddCalendarAccountForm() {
  const queryClient = useQueryClient();
  const { mutateAsync, isPending } = useMutation('post', '/api/calendar/accounts');

  const handleSave = async (data: NewAccount) => {
    await mutateAsync({ body: data });
    await queryClient.invalidateQueries({
      queryKey: calendarQueries.accounts().queryKey, // typed, never a string
    });
  };
}
```

**Note:** `useQueryClient` is the one exception to the "import from client.ts" rule — it accesses the cache, not the fetch client, so it still comes from `@tanstack/react-query`.

### Convention 5 — Three-tier error handling

| Tier | Where | Handles |
| --- | --- | --- |
| **1 — Middleware** | `src/api/client.ts` | 401 (reload), 403 (toast), normalizes all HTTP errors to typed `Error` with `.status` |
| **2 — Global MutationCache** | `src/main.tsx` | Any unhandled mutation error — shows a generic toast so nothing fails silently |
| **3 — Per-mutation try/catch** | Component | Only when a specific failure needs specific UI feedback (keep dialog open, show field error) |

```typescript
// src/main.tsx
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      retry: (count, error) => {
        const status = (error as { status?: number }).status;
        if (status === 401 || status === 403) return false;
        return count < 3;
      },
    },
  },
  mutationCache: new MutationCache({
    onError: () => toast.error('Something went wrong — please try again'),
  }),
});
```

### Open questions

1. Should mutations be extracted into custom hooks too, or stay inline in components? Inline is simpler; extracted hooks are easier to test in isolation.
2. Real-time features (chat streaming, agent status) need `staleTime: 0` or WebSocket integration — per-query override is easy, but should there be a named `realtimeQueryOptions` factory for clarity?

---

## Tooling

### Python

**`uv`** — package manager and virtual environment.

```bash
uv sync          # install deps from lockfile
uv add httpx     # add a dependency
```

**`pyproject.toml`** — single source of truth for deps, dev deps, and tool config. Replaces `requirements.txt`.

```toml
[project]
name = "odysseus"
requires-python = ">=3.11"
dependencies = [
  "fastapi",
  "uvicorn[standard]",
  "sqlalchemy",
  ...
]

[tool.ruff]
line-length = 100
target-version = "py311"

[tool.ruff.lint]
select = ["E", "F", "I", "UP"]  # pycodestyle, pyflakes, isort, pyupgrade

[tool.pytest.ini_options]
testpaths = ["tests"]
```

**`ruff`** — linting and formatting. One tool, no config file needed beyond `pyproject.toml`.

```bash
ruff check .          # lint
ruff format .         # format
ruff check --fix .    # lint + auto-fix
```

**`basedpyright`** — static type checker. Catches type errors without running the code (wrong argument types, missing attributes, incompatible return values). A fork of Microsoft's Pyright that is open source and works in all VS Code forks (Cursor, VS Codium, Windsurf) where Pylance is unavailable. Configured in `pyproject.toml`:

```toml
[tool.basedpyright]
pythonVersion = "3.11"
typeCheckingMode = "standard"
```

Run as a CLI or install the VS Code extension (`ms-pyright.basedpyright`). In CI, add after `ruff`:

```yaml
- run: uv run basedpyright .
```

### Frontend

**`Biome`** — replaces ESLint + Prettier. Configured in `biome.json`.

```json
{
  "$schema": "https://biomejs.dev/schemas/1.9.0/schema.json",
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2
  },
  "linter": {
    "enabled": true,
    "rules": { "recommended": true }
  },
  "javascript": {
    "formatter": { "quoteStyle": "single", "semicolons": "always" }
  }
}
```

```bash
biome check .          # lint + format check
biome check --write .  # lint + format fix
```

### Pre-commit Hooks

```yaml
# .pre-commit-config.yaml
repos:
  - repo: local
    hooks:
      - id: ruff-check
        name: ruff lint
        entry: ruff check --fix
        language: system
        types: [python]
      - id: ruff-format
        name: ruff format
        entry: ruff format
        language: system
        types: [python]
      - id: biome-check
        name: biome check
        entry: pnpm biome check --write
        language: system
        types: [javascript, typescript, tsx, jsx]
```

### Docker

- `COMPOSE_FILE` overlay pattern for GPU support stays as-is.
- Add `Z` flag to all bind mounts for SELinux compatibility (Fedora/RHEL):

  ```yaml
  volumes:
    - ./data:/app/data:Z
    - ./logs:/app/logs:Z
  ```

---

## Testing

### Early Philosophy

Smoke tests only — not exhaustive. The goal is catching broken endpoints before they hit `main`, not 100% coverage. Unit tests for pure functions where the logic is complex enough to warrant it.

### Structure

```tree
tests/
├── conftest.py           # Shared fixtures: TestClient, test DB, auth headers
├── smoke/                # One test file per API domain
│   ├── test_auth.py      # Login, logout, session, token validation
│   ├── test_chat.py      # Send message, list sessions, delete session
│   ├── test_calendar.py  # List events, CalDAV accounts CRUD
│   ├── test_email.py     # List accounts, fetch inbox, send
│   ├── test_agent.py     # Create task, poll status
│   ├── test_memory.py    # Store and retrieve memory
│   └── test_documents.py # Upload, list, delete
└── unit/                 # Pure function tests, no HTTP
    ├── test_caldav_sync.py
    ├── test_ical_parser.py
    └── test_date_utils.py
```

### Fixture Pattern

```python
# tests/conftest.py
import pytest
from fastapi.testclient import TestClient
from app import app
from core.database import Base, engine

@pytest.fixture(scope="session")
def client():
    Base.metadata.create_all(bind=engine)
    with TestClient(app) as c:
        yield c
    Base.metadata.drop_all(bind=engine)

@pytest.fixture
def auth_headers(client):
    r = client.post("/api/auth/login", json={"username": "test", "password": "test"})
    return {"Authorization": f"Bearer {r.json()['token']}"}
```

### Smoke Test Pattern

```python
# tests/smoke/test_calendar.py
def test_list_events_requires_auth(client):
    r = client.get("/api/calendar/events")
    assert r.status_code == 401

def test_list_events(client, auth_headers):
    r = client.get("/api/calendar/events", headers=auth_headers)
    assert r.status_code == 200
    assert "events" in r.json()

def test_caldav_accounts_crud(client, auth_headers):
    # Create
    r = client.post("/api/calendar/accounts",
        headers=auth_headers,
        json={"name": "Test", "url": "http://test", "username": "u", "password": "p"})
    assert r.status_code == 200
    account_id = r.json()["id"]
    # List
    r = client.get("/api/calendar/accounts", headers=auth_headers)
    assert any(a["id"] == account_id for a in r.json()["accounts"])
    # Delete
    r = client.delete(f"/api/calendar/accounts/{account_id}", headers=auth_headers)
    assert r.status_code == 200
```

### CI

```yaml
# .github/workflows/ci.yml
name: CI
on: [pull_request]
jobs:
  backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: astral-sh/setup-uv@v3
      - run: uv sync
      - run: ruff check .
      - run: ruff format --check .
      - run: pytest tests/smoke/ -v

  frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: latest }
      - uses: pnpm/action-setup@v4
        with: { version: latest }
      - run: pnpm install --frozen-lockfile
        working-directory: frontend
      - run: pnpm biome check .
        working-directory: frontend
      - run: pnpm run generate:api
        working-directory: frontend
      - run: git diff --exit-code src/api/schema.ts
        working-directory: frontend
      - run: pnpm run build
        working-directory: frontend
```

---

## Rules & Conventions

### General

- One PR per concern. A PR that restructures files and adds a feature will be rejected.
- PRs must pass CI before review. Don't ask for a review on a red build.
- No `any` in TypeScript except in generated files or with a justification comment.
- No `print()` in Python — use `logging.getLogger(__name__)`.
- No hardcoded strings that appear in more than one place — put them in `core/config.py` or `lib/constants.ts`.

### Backend

- Handlers in `api/` have no direct DB access. They call services.
- Services return plain Python objects or dataclasses — not SQLAlchemy model instances. Serialize at the API layer.
- Every new model column needs a migration function in `core/database.py` and a call in `init_db()`.
- All LLM prompt strings live in the domain's `prompts.py`. No inline prompt strings in business logic.
- Enums and constants stay local to the module that owns them. Do not centralise unrelated constants into a shared file.
- No `import *` anywhere.

### Frontend

- Every API call goes through `api/client.ts`. No raw `fetch()` in components.
- No server data in Zustand. If it came from an endpoint, it belongs in TanStack Query.
- No URL state in Zustand. If it should survive a refresh, it belongs in nuqs.
- Component files: PascalCase (`MessageList.tsx`). Everything else: camelCase (`useCalendar.ts`).
- shadcn/ui components live in `components/ui/` and are never edited directly — run `shadcn add` to update them.
- Page components (`pages/*/index.tsx`) are route entry points only — they compose feature components, they don't contain logic.

### Git

- Branch naming: `feat/<short-description>`, `fix/<short-description>`, `chore/<short-description>`
- Commit style: imperative mood, present tense — `"Add CalDAV account support"` not `"Added"` or `"Adding"`
- Reference issues in commits: `"Fix event UID collision (#519)"`
- Target branch: `dev` (not `main`) for all feature and fix PRs

---

## Context Files & ADRs

As the codebase grows, two things break down simultaneously: AI assistants load irrelevant context for every task, and human contributors have no record of *why* decisions were made. This section defines the system that solves both.

### Part 1 — CONTEXT.md Files

Instead of one monolithic `CLAUDE.md` that loads for every task, each major area of the codebase has its own `CONTEXT.md`. The root `AGENTS.md` is kept minimal — it describes the project in a few sentences and tells the agent which `CONTEXT.md` to read for the area it is working in.

```tree
.
├── AGENTS.md                        # Root — project overview + pointer map only
├── backend/
│   ├── CONTEXT.md                   # Layer rules, migration pattern, prompts convention
│   └── services/
│       ├── calendar/
│       │   └── CONTEXT.md           # CalDAV sync details, account ID scheme, known edge cases
│       ├── email/
│       │   └── CONTEXT.md           # IMAP/SMTP quirks, provider-specific behaviour
│       └── agent/
│           └── CONTEXT.md           # Tool loop behaviour, MCP integration notes
└── frontend/
    └── CONTEXT.md                   # TanStack Query conventions, state decision tree, Biome rules
```

**Root `AGENTS.md`** — short and directive. No implementation details:

```markdown
# Odysseus

Self-hosted AI workspace. FastAPI backend, React + TypeScript frontend.

## Where to look

- Backend rules and layer conventions: `backend/CONTEXT.md`
- Frontend conventions: `frontend/CONTEXT.md`
- Architecture decisions: `docs/adr/`

## Global rules

- Never commit `.env` or anything in `data/`
- All PRs target `dev`, not `main`
- Run `pnpm run generate:api` after any backend endpoint change

## Before implementing something non-trivial

Read `docs/adr/` first. ADRs record why things are the way they are.
Patterns in ADRs take precedence over conventions you might infer from the code.
```

**CONTEXT.md files** describe *how* things work in that area — domain-specific rules, naming schemes, known edge cases.

### Part 2 — Architecture Decision Records (ADRs)

An ADR records a single architectural decision: what was decided, why, and what alternatives were considered. They live in `docs/adr/` and are immutable once written — if a decision changes, a new ADR supersedes the old one.

```tree
docs/
└── adr/
    ├── 000-template.md
    ├── 001-backend-layer-conventions.md
    ├── 002-vite-over-nextjs.md
    ├── 003-pnpm-over-npm.md
    ├── 004-openapi-typescript-for-api-types.md
    └── 005-tanstack-router-over-react-router.md
```

**ADR template:**

```markdown
# ADR-{N}: {Short title}

**Status:** Accepted | Superseded by ADR-{N}
**Date:** YYYY-MM-DD

## Decision

{One sentence — what was decided.}

## Context

{Why this decision needed to be made. What problem it solves.}

## Alternatives considered

| Option | Why rejected |
|---|---|
| {Alternative A} | {Reason} |

## Consequences

{What this decision means going forward. Any tradeoffs accepted.}
```

**ADR rules:**

- One decision per ADR
- Immutable once accepted — write a new ADR to supersede, never edit
- Written at decision time, not retroactively
- Linked from the relevant `CONTEXT.md` so readers can follow the reasoning
- PR author's responsibility — if your PR makes a significant design choice, write the ADR. Reviewers may request one.

### Relationship

`CONTEXT.md` describes **how** things work. ADRs explain **why** those rules exist.

A `CONTEXT.md` entry might say: *"Google CalDAV is not supported as a preset — see ADR-006."*  
And `ADR-006` explains that Google's endpoint requires OAuth2, basic auth is deprecated, and the decision was to wait until OAuth is implemented rather than ship something misleading.

Together they give AI assistants and human contributors the full picture without either file carrying the entire weight of documentation.

---

## Migration Strategy

The migration is split into two tracks. The **critical track** contains stop-the-bleeding items that are valuable regardless of any architecture decision and can ship immediately. The **main track** is the full restructure and depends on the critical track being in place first.

---

### Critical Track — Ship independently, no architecture decisions required

These three items survive any future stack change and unblock everything else. They can be worked on in parallel by different contributors right now.

#### Critical-1 — Branching & Governance

- Create `dev` branch off current `main`
- Set `dev` as default PR target in GitHub settings
- Add branch protection: require CI green + one review before merge
- Add `CODEOWNERS` file — assigns automatic reviewers to structural areas of the codebase:

  ```tree
  # .github/CODEOWNERS
  /backend/          @maintainer
  /frontend/         @maintainer
  /.github/          @maintainer
  /docker-compose*   @maintainer
  ```

  Adjust usernames once maintainer designates reviewers. See #593.

#### Critical-2 — Python Packaging & Linting

- Replace `requirements.txt` with `pyproject.toml` + `uv.lock`
- Add `ruff` config to `pyproject.toml`
- Run formatter across all Python files in one formatting-only commit
- Add `pre-commit` hooks for `ruff check` + `ruff format`
- Fix Docker bind mount `Z` flags for SELinux compatibility

#### Critical-3 — CI Gate + Smoke Tests

- Add GitHub Actions CI workflow (see [CI](#ci) section)
- Add `tests/conftest.py` with shared fixtures
- Add smoke tests for each API domain
- PRs to `dev` are blocked until CI is green

---

### Main Track — Full restructure (depends on critical track)

Each phase is a separate PR to `dev`. No phase assumes the previous one landed within a phase — they can proceed in any order.

### Phase 0 — Frontend Tooling Setup

- Scaffold `frontend/` with Vite + React + TypeScript
- Configure pnpm, Biome, TanStack Router, TanStack Query, Zustand, nuqs, shadcn/ui
- Set up `openapi-typescript` schema generation script (`pnpm run generate:api`)
- Generate initial `src/api/schema.ts` from the existing backend
- FastAPI serves `frontend/dist/` alongside existing `static/` (both active during migration)
- Wire up one page end-to-end as proof of concept (Settings — most self-contained)

### Phase 1 — Backend Restructure

- Create `backend/` directory structure
- Move files to their correct locations: `routes/` → `api/`, `src/` + `services/` → `services/domain/`
- Update all imports
- No logic changes — verified by smoke tests passing before and after
- One PR per domain (calendar, email, chat, etc.) to keep diffs reviewable

### Phase 2 — Frontend Migration

- One page per PR: Settings → Chat → Calendar → Email → Agent → ...
- Each page ships when complete; old JS equivalent removed in the same PR
- `static/` directory deleted when the last page is migrated

---

## E2E Tests

Smoke tests catch broken API endpoints. E2E tests catch broken user flows — they simulate a real browser and verify that the full stack works together. Both are needed for confident releases.

**Tool: Playwright** — the standard for React apps, first-class TypeScript support, runs in CI headlessly.

Add to Critical-3 alongside the smoke tests:

```tree
tests/
├── smoke/      # pytest — API-level, fast, run on every PR
└── e2e/        # Playwright — browser-level, run on every PR to dev/main
    ├── auth.spec.ts        # Login, logout, session persistence
    ├── chat.spec.ts        # Send a message, receive a streamed response
    ├── calendar.spec.ts    # View events, add CalDAV account
    ├── email.spec.ts       # List inbox, open email
    └── settings.spec.ts    # Save a setting, verify it persists
```

```yaml
# Added to CI workflow
  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: astral-sh/setup-uv@v3
      - run: uv sync && python -m uvicorn app:app --host 0.0.0.0 --port 7000 &
      - uses: pnpm/action-setup@v4
      - run: pnpm install --frozen-lockfile
        working-directory: frontend
      - run: pnpm exec playwright install --with-deps chromium
        working-directory: frontend
      - run: pnpm exec playwright test
        working-directory: frontend
```

---

## Future Work

Items that are good ideas but explicitly out of scope for this restructure. Noted here so they don't get lost.

**Desktop app (Tauri):** A native wrapper around the web app would significantly lower the barrier to entry for non-technical users. [Tauri](https://v2.tauri.app/) is the recommended approach over Electron — it is Rust-based, uses the OS's native webview rather than bundling Chromium, and has a significantly smaller binary and memory footprint. This is a separate project track that makes most sense after the frontend migration is complete so there is a stable React app to wrap.

**CLI / server mode:** Exposing the backend as a CLI (`odysseus serve`) that can be started independently and connected to from a remote client or desktop app. Good for power users and self-hosting scenarios. Worth designing once the backend restructure is complete and the API layer is clean.

---

## Open Questions

These require a decision from the maintainer before the relevant phase can start.

| Question | Impact |
| --- | --- |
| Who is the designated reviewer for structural PRs? | Critical-1 |
| Keep `static/` JS as read-only during migration or allow parallel fixes? | Phase 0–2 |
