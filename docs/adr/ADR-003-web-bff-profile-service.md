# ADR-003: Web Layer Profile Service Is Standalone (BFF Pattern)

Date: 2026-05-26
Status: Accepted

## Context

S-002 adds profile creation and retrieval. The same architectural question from ADR-001 (auth) applies here: should the Next.js BFF routes for `/api/profile/*` proxy to the Fastify API, or implement their own service?

Playwright E2E tests start only the Next.js dev server on port 3002. Fastify is not running during those tests.

## Decision

The Next.js web profile routes are standalone for the browser client. They use `web/lib/profile/service.ts` (`InMemoryProfileService`) and `web/lib/profile/handler.ts` (a singleton via `global.__profileHandler`). They do not proxy to Fastify.

This is the same BFF isolation pattern established in ADR-001 for auth.

Both layers implement the same `IProfileService` TypeScript interface as the canonical contract.

## Consequences

- **Positive**: E2E tests covering onboarding and the profile page work with no Fastify process or database running.
- **Negative**: Profile logic is not de-duplicated between the web BFF and Fastify layers. Changes to onboarding validation must be mirrored in both `web/lib/profile/` and `api/src/`.
- **Mitigation**: The shared `IProfileService` interface enforces the contract boundary. Both adapters must satisfy it.

## Future

In production both layers will back onto Supabase (`supabase-js` direct calls on the web side, Postgres via Fastify on the API side). The `InMemoryProfileService` is a dev/test adapter only.
