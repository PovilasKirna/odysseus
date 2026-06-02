# Odysseus

Self-hosted AI workspace. FastAPI backend, JavaScript frontend. Supports chat, agents, deep research, documents, memory, email, calendar, notes, and model management (Ollama, vLLM, OpenRouter, OpenAI, and more).

## Where to look

| Area | Read |
| --- | --- |
| Backend layer rules, database, git conventions | `docs/architecture.md` |
| Architecture decisions and why they were made | `docs/adr/` |
| Backend service — calendar, email, chat, etc. | `backend/services/<domain>/CONTEXT.md` *(coming)* |
| Frontend conventions | `frontend/CONTEXT.md` *(coming)* |

## Global rules

- Never commit `.env`, `data/`, or anything listed in `.gitignore`
- All PRs target `dev`, not `main`
- One PR per concern — a PR that restructures files and adds a feature will be rejected

## Before making a non-trivial design decision

Read `docs/adr/` first. ADRs record why things are the way they are — what was tried, what was rejected, and what tradeoffs were accepted. Patterns documented in an ADR take precedence over conventions you might infer from the code alone.
