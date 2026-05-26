# ADR-005: Skill Delete Requires force=true When Session History Exists

Date: 2026-05-26
Status: Accepted

## Context

When a user deletes a sub-skill that has associated session logs, deleting it also destroys training history that cannot be recovered. A frontend confirmation dialog alone is not sufficient protection: any direct API caller (scripts, future mobile clients, tests) bypasses the UI and would silently delete history with a plain `DELETE /api/skills/:id`.

Two options were considered:

1. Frontend-only guard — show a confirmation dialog in the UI, perform the delete unconditionally at the API layer.
2. API-enforced guard — the API rejects the delete with `400` unless `?force=true` is explicitly passed; the frontend sends `force=true` only after the user confirms the dialog.

## Decision

The API enforces the safety check. `DELETE /api/skills/:id` returns `400` with a descriptive error message when the skill has session history and `force=true` is absent. The frontend confirmation dialog is still shown to the user, but it is not the last line of defence.

## Consequences

- **Positive**: Any caller — UI, script, or future client — must explicitly acknowledge history destruction. Accidental deletions via direct API calls are blocked regardless of whether a frontend guard exists.
- **Positive**: The contract is self-documenting: a `400` response tells the caller exactly what is needed (`force=true`) rather than silently succeeding or returning a vague error.
- **Negative**: Clients performing automated cleanup must be updated to pass `force=true` explicitly. A simple `DELETE` is no longer unconditional.
- **Negative**: Adds a round-trip in the common case where history exists: the client may discover the `400` only after attempting the delete, then must re-confirm and retry with `force=true`. Mitigated by the frontend fetching skill state (including `has_history`) before rendering the delete flow.
