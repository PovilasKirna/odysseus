# ADR-021: Security baseline — SSRF, path traversal, and input validation

**Status:** Proposed  
**Date:** 2026-06-02

## Decision

Establish a documented security baseline for the three classes of vulnerability most active in the current issue backlog: server-side request forgery (SSRF), path traversal, and insufficient input validation. All new routes and features must be reviewed against this baseline before merge.

## Context

Multiple PRs are currently in flight adding SSRF protection (#775 and related), path traversal fixes, and input validation layers — with no documented baseline for what "secure" looks like in this codebase. Each PR is inventing its own approach. Without a shared standard, the fixes are inconsistent: one route blocks private IP ranges, another doesn't; one validates file paths with `os.path.abspath`, another with a regex. The inconsistency means the codebase looks patched rather than hardened.

Odysseus is a self-hosted app that users expose on their LAN. The threat model is a malicious user on the same network or a confused-deputy attack via a malicious AI tool call. Full internet exposure is not the primary threat model, but LAN exposure is real and documented.

## Alternatives considered

| Option | Why rejected |
| --- | --- |
| **Fix vulnerabilities as reported** | Status quo. Reactive, produces inconsistent fixes, and doesn't prevent the same class of bug in new features. |
| **Full security audit / external pentest** | Appropriate eventually, but not a substitute for documented conventions that prevent the vulnerability class from being introduced in the first place. |
| **WAF or reverse proxy rules** | Deployment-side mitigations don't help contributors writing new backend features. The fix needs to be in the code conventions. |

## Consequences

**SSRF:**
- Any feature that makes an outbound HTTP request based on user-supplied input (URLs, provider endpoints, webhook targets) must validate the target against an allowlist or blocklist before the request is made
- Private IP ranges (RFC 1918: `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`), loopback (`127.0.0.0/8`), and link-local (`169.254.0.0/16`) are blocked by default
- Use the shared `validate_outbound_url(url)` utility — do not reimplement this per-route

**Path traversal:**
- Any route that reads or writes a file based on user-supplied input must resolve the path with `os.path.realpath()` and assert it is within the expected base directory before any file operation
- File upload endpoints must validate the final resolved path, not the raw filename
- Do not use `os.path.join(base, user_input)` without a subsequent `realpath` + prefix check — this is the common mistake

**Input validation:**
- All route parameters and request bodies are validated with Pydantic models — raw `request.json()` access without a model is not permitted in new routes
- String fields that are used in file paths, shell commands, or SQL must have explicit length limits and character allowlists in their Pydantic validators
- Shell route safety: any feature that runs a subprocess with user-supplied arguments must use `shlex.split()` and a command allowlist — no `shell=True` with user input

**Review gate:**
- PRs adding new routes or features that make outbound requests, read/write files, or execute subprocesses must include a brief security note in the PR description confirming these patterns were followed
