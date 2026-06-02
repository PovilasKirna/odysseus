# ADR-008: shadcn/ui copy-into-repo component model

**Status:** Proposed  
**Date:** 2026-06-02

## Decision

Use shadcn/ui for the component library. Components are copied into `src/components/ui/` via the shadcn CLI and owned by the repo — not installed as a versioned npm dependency.

## Context

The frontend needs a component library. The choice determines how much flexibility we have over styling, how locked-in we are to a library's versioning, and how much work it takes to match Odysseus's existing dark aesthetic with accent color variants.

## Alternatives considered

| Option | Why rejected |
| --- | --- |
| **MUI (Material UI)** | Strong visual identity that is hard to override without fighting the library. Produces Material Design aesthetics by default — not aligned with Odysseus's current look. |
| **Chakra UI** | Runtime CSS-in-JS adds bundle weight and can cause flash-of-unstyled-content. Less active development recently. |
| **Radix UI (primitives only)** | shadcn/ui is built on Radix primitives. Using Radix directly skips the styling layer that shadcn provides — we would be reimplementing what shadcn already solved. |
| **Headless UI (Tailwind)** | Smaller component set, less community momentum than shadcn. |
| **No library, write from scratch** | Accessible, well-tested component primitives (combobox, dialog, popover, date picker) take weeks to build correctly. Not a good use of contributor time. |

## Consequences

- Components live in `src/components/ui/` and are tracked in git — contributors can see exactly what a `Button` or `Dialog` renders
- Updating a component runs `pnpm dlx shadcn@latest add <component>` — the diff is visible and reviewable
- No version lock-in: if shadcn changes direction, we own the code and can fork at any point
- Odysseus's existing color themes (red, purple, blue accent variants) map directly onto shadcn's CSS custom property token system via `data-theme` on `<html>` — see architecture doc for the migration approach
- **Do not edit files in `src/components/ui/` directly.** Use `shadcn add` to update. If a component genuinely needs a one-off customisation that shadcn's API does not support, create a wrapper: `src/components/[ComponentName].tsx` that imports from `ui/` and adds the custom behaviour. Document the override and its reason in the domain `CONTEXT.md` so the next contributor knows not to flatten it — and so a `shadcn add` update does not silently overwrite something intentional.
