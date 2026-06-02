# ADR-020: Authentication and session handling

**Status:** Proposed  
**Date:** 2026-06-02

## Decision

All routes that access user data must enforce owner scoping — every DB query that returns user-owned rows must filter by the authenticated `owner` field. Authentication state must live in the database, not in flat files. Admin-only routes must use a dedicated middleware guard, not ad-hoc checks inside route handlers.

## Context

Several security PRs have landed fixing variations of the same bug: a route queried a table without filtering on `owner`, returning data from one user to another. The root cause is not malice — it is that the auth contract is not documented anywhere, so contributors add new routes without knowing the pattern. Each null-owner fix requires discovering the problem through a security report rather than a code review catching a missing filter.

There is also a structural issue: session state is split between `app.db` (SQLAlchemy-managed) and `auth.json` (flat file). Contributors working on auth-adjacent features have to know which store to read from, and the two can drift out of sync.

## Alternatives considered

| Option | Why rejected |
| --- | --- |
| **Per-route auth logic (status quo)** | Already causing repeated null-owner vulnerabilities. No central enforcement means every new route is a potential gap. |
| **JWT tokens, no session DB** | Stateless tokens cannot be revoked server-side — a logged-out user with a valid token can still make requests. Not appropriate for a self-hosted tool that may be exposed on a LAN. |
| **Separate auth service** | Over-engineered for a single-user or small-team self-hosted app. Adds deployment complexity with no benefit at this scale. |

## Consequences

- All routes accessing user data must go through a `get_current_user` dependency that returns the authenticated user object; raw DB queries must never bypass this
- Every SQLAlchemy query on a user-owned table must include `.filter_by(owner=current_user.id)` — this is a code review gate, not just a convention
- Admin-only routes use a dedicated `require_admin` middleware applied at the router level, not inline checks in individual handlers
- Session tokens are stored in `app.db` with an expiry timestamp — `auth.json` is deprecated as part of ADR-007 (database consolidation) and must not be used for new auth state
- A `test_null_owner_gates.py` regression test (already exists) must be extended for every new route that returns user-owned data — CI fails if a new route is added without a corresponding owner-gate test
- Password hashing uses `bcrypt` — do not use `hashlib` or plain storage anywhere in auth flows
