# ADR-004: SupabaseAuthService.getUserId() Throws NotImplementedError

Date: 2026-05-26
Status: Accepted

## Context

`IAuthService` requires a synchronous method `getUserId(token: string): string | undefined`. The web BFF profile routes call this to extract the user ID from the session cookie before performing profile operations.

Supabase JWT verification requires `supabase.auth.admin.getUser(token)` — an async network call to Supabase. This cannot be satisfied synchronously without refactoring the `IAuthService` interface.

Two options considered:
1. Return `undefined` silently — profile routes return 401, masking the root cause.
2. Throw a `NotImplementedError` with a message explaining the gap.

## Decision

`SupabaseAuthService.getUserId()` throws `NotImplementedError` with a message that names the gap and what must be done before production use.

## Consequences

- **Positive**: Any production deployment with Supabase will hard-fail immediately on profile routes, making the gap impossible to miss. Silent incorrect behavior (returning 401 with no indication of why) is avoided.
- **Negative**: Profile routes are non-functional with `SupabaseAuthService` until async JWT verification is implemented and the interface is updated.
- **Mitigation**: This is intentional. The `InMemoryProfileService` path (used in dev/test) is fully functional. The Supabase path requires a follow-up story to make `getUserId` async before any production deployment.

## Future

A future story must either (a) make `IAuthService.getUserId()` async throughout both layers, or (b) replace the synchronous call in profile routes with a dedicated async `verifyToken(token)` method, before `SupabaseAuthService` can serve production traffic.
