# ADR-005: RLS Enforced at the Database Layer

Date: 2026-05-26
Status: Accepted

## Context

Phase 1 tables store per-user data (profiles, skills, session logs). The system has two server-side layers: a Fastify API and a Next.js BFF. Both layers will eventually have application-level auth checks. The question was whether data isolation should be enforced only at the application layer, or also at the database layer via PostgreSQL Row-Level Security (RLS).

## Decision

RLS is enabled on all Phase 1 tables (`user_profiles`, `skill_categories`, `user_skills`, `session_logs`). All per-user policies use `auth.uid()` — the caller's UUID extracted from the current Supabase JWT — as the row-ownership predicate.

## Consequences

- **Positive**: Data isolation is enforced regardless of which application layer (Fastify, Next.js BFF, direct Supabase client, future mobile client) accesses the database. A bug or missing auth check in application code cannot leak another user's rows.
- **Positive**: Security audits and compliance reviews can point to a single enforcement boundary in the database rather than tracing every code path in every service.
- **Negative**: Every query runs through a policy evaluation. For simple equality predicates (`id = auth.uid()`, `user_id = auth.uid()`) the overhead is negligible, but it is non-zero.
- **Negative**: Integration tests must authenticate as the target user before querying, adding setup boilerplate. Tests that bypass auth must use a `SERVICE_ROLE` key or a SECURITY DEFINER function.
