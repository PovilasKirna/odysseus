## What does this PR do?

<!-- One paragraph. What changed and why. If this closes an issue, say so here. -->

Closes #

## Type of change

- [ ] Bug fix
- [ ] New feature
- [ ] Refactor / cleanup
- [ ] Documentation only
- [ ] Tooling / CI

## Checklist

- [ ] This PR targets `dev`, not `main`
- [ ] This PR does **one thing** — no mixed refactor + feature in the same PR
- [ ] CI is green (do not request a review on a failing build)
- [ ] No `print()` in Python — use `logging.getLogger(__name__)`
- [ ] No `any` in TypeScript unless in a generated file or with a justification comment
- [ ] If a backend endpoint changed: ran `pnpm run generate:api` and committed the updated `schema.ts`
- [ ] If a new model column was added: migration function in `core/database.py` and called in `init_db()`
- [ ] If this introduces or changes a design decision: added or updated the relevant ADR in `docs/adr/`
- [ ] If this changes how an area of the codebase works: updated the relevant `CONTEXT.md`

## How was this tested?

<!-- Describe what you ran. Paste relevant output or a screenshot. "It works on my machine" is not a test plan. -->
