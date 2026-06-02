# ADR-006: Zustand over Redux (or Context) for client UI state

**Status:** Proposed  
**Date:** 2026-06-02

## Decision

Use Zustand for ephemeral client-side UI state. Do not use Redux, Redux Toolkit, or React Context for shared state.

## Context

The frontend needs a place for state that is neither server data (which belongs in TanStack Query) nor URL state (which belongs in nuqs) — things like sidebar open/closed, active modal, theme selection, and current user session info. This state is client-only, ephemeral, and does not need to survive a page refresh.

## Alternatives considered

| Option | Why rejected |
| --- | --- |
| **Redux / Redux Toolkit** | Significant boilerplate for simple state. Requires actions, reducers, and selectors for what amounts to a handful of booleans and strings. LLMs also tend to generate verbose Redux patterns that make PRs hard to review. |
| **React Context** | Fine for simple cases, but causes unnecessary re-renders when context value changes — the whole subtree re-renders. Requires careful memoization that contributors routinely forget. Doesn't scale past 2–3 values without becoming unwieldy. |
| **Jotai** | Atom-based approach works well but is less familiar than Zustand to the average contributor and has more concepts to learn. |
| **MobX** | Observable-based reactivity model is significantly different from React's mental model. Harder for AI-assisted contributors who expect React-idiomatic patterns. |

## Consequences

- Zustand stores are plain functions with minimal boilerplate — a new contributor can read and understand a store in under a minute
- State updates are direct mutations via `set()` — no actions or reducers needed
- Selecting a specific value with `useStore(s => s.value)` only re-renders the component when that value changes
- **Hard rule:** server data never goes into Zustand. If it came from an API endpoint, it belongs in TanStack Query. Zustand is for UI state only.
- **Hard rule:** shareable or refresh-persistent state never goes into Zustand. If it should survive a refresh or be bookmarkable, it belongs in nuqs.
