# ADR-018: Dependency governance — release age policy and supply-chain checks

**Status:** Proposed  
**Date:** 2026-06-02

## Decision

Block merges that introduce a dependency released less than 30 days ago. Enforce via a CI check against the PyPI release-date API. Run `pip-audit` on every PR that touches `pyproject.toml` or `requirements.txt`. CVE patches are exempt from the age requirement.

## Context

The project is receiving a high volume of PRs, many of which add or upgrade packages. The current process has no supply-chain checks. Compromised-package incidents (xz-utils, event-stream) typically go undetected for weeks to months — a 30-day buffer meaningfully increases the chance that security researchers, blog posts, and community analysis surface an issue before it lands here. PyPI's own guidance recommends 30 days for production deployments.

## Alternatives considered

| Option | Why rejected |
| --- | --- |
| **14-day minimum** | Provides little more coverage than a week; the real threat vector (compromised legitimate packages) typically takes longer to surface. 14 days is not meaningfully safer than no policy. |
| **No age policy, pip-audit only** | `pip-audit` catches known CVEs but not newly compromised packages that have not yet been assigned a CVE. The two checks are complementary, not interchangeable. |
| **Manual review only** | Does not scale at the current PR volume. A maintainer reviewing 10+ deps-touching PRs per week cannot reliably catch release dates manually. |
| **Pin to hashes only (no age policy)** | Hash pinning ensures reproducibility but does not prevent a compromised package from being pinned — it just makes the compromise reproducible. Age policy adds a time-based buffer on top of reproducibility. |

## Consequences

- CI runs on every PR touching `pyproject.toml` or `requirements.txt` (Python) and `package.json` (npm)
- The age check queries `https://pypi.org/pypi/{package}/{version}/json` and fails if any package was released less than 30 days ago
- `pip-audit` runs in the same CI job and fails on any known CVE in the dependency tree
- CVE patches are fast-tracked regardless of age — the PR description must include the CVE identifier to trigger the carve-out
- The npm side relies on `package-lock.json` integrity hashes; `npm audit` is added to CI for the same job
- The check is advisory-only for the first 30 days after adoption to surface false positives before it blocks merges

## Implementation reference

The CI check script and the PyPI age-query logic were proposed in issue #485 and can be used directly as the starting point for implementation.
