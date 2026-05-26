# ADR-002: Profile PK Equals Auth User UUID

Date: 2026-05-26
Status: Accepted

## Context

The `user_profiles` table has a one-to-one relationship with `auth.users`. Each user has exactly one profile row; the profile IS the user's extended data. When creating a profile, there are two options for the primary key: (a) generate a new `randomUUID()` and store a separate `user_id` FK, or (b) use the auth user's UUID directly as the profile row's PK.

## Decision

`user_profiles.id` is both the PK and a FK to `auth.users`. `InMemoryProfileService.onboard()` inserts `id: userId` — it does not call `randomUUID()`.

## Consequences

- **Positive**: Any caller who has the user's auth token already knows the profile key. No extra lookup required to go from session → profile. Joins between tables are trivially `ON profile.id = auth_user.id`.
- **Negative**: Cannot have multiple profiles per user (intentional constraint — the system design is one profile per account).
- **Mitigation**: None needed. Multiple profiles per user are not a product requirement and are explicitly excluded.

## Future

When migrating to Supabase, the `user_profiles` table will enforce this via `id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE` and an RLS policy of `SELECT/UPDATE WHERE id = auth.uid()`.
