# ADR-006: session_logs Has No Direct DELETE Policy

Date: 2026-05-26
Status: Accepted

## Context

`session_logs` records every training session a user completes. XP values are derived from these records — accumulated XP, decay calculations, and streak history all depend on the log being intact. If users could delete individual session rows, they could retroactively alter their XP history, breaking the integrity of the progression system.

Two options were considered:

1. Permit direct DELETE with `user_id = auth.uid()` — consistent with how `user_skills` works, but allows arbitrary history edits.
2. Omit the DELETE policy entirely and rely on cascade deletion from `user_skills` — sessions are removed only when their parent skill is deleted, taking the entire skill's history with it.

## Decision

`session_logs` has no RLS DELETE policy. The `authenticated` role is granted only `SELECT` and `INSERT`. Rows are deleted exclusively via `ON DELETE CASCADE` from `user_skills`.

## Consequences

- **Positive**: XP history is append-only from the application's perspective. No individual session can be selectively removed to inflate or repair a user's progression record.
- **Positive**: The invariant is enforced at the database layer (grant + RLS) rather than relying on application code to refuse DELETE requests.
- **Negative**: If a user logs a session by mistake, there is no self-service correction. A correction mechanism (if ever needed) must be a server-side admin operation or a compensating INSERT (e.g., a negative-XP correction row), not a DELETE.
- **Negative**: Deleting a skill to clean up data silently removes all of that skill's session history. This is the intended behavior but must be documented in UX copy when the skill deletion flow is built.
