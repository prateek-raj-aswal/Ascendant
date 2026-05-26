# ADR-001: Web Layer Auth Is Standalone (Not Proxying Fastify)

**Status**: Accepted  
**Story**: S-001  
**Date**: 2026-05-26

## Context

The system has two server-side layers:
- **Fastify API** (`api/`, port 3001) — canonical REST API for data operations and programmatic access
- **Next.js web** (`web/`, port 3002) — browser frontend + BFF API routes

For S-001, the Next.js `/api/auth/*` routes implement their own `InMemoryAuthHandler` (dev/test) instead of proxying to the Fastify API.

## Decision

The Next.js web auth routes are **standalone for the browser client**. They do NOT proxy to Fastify. Reasons:

1. **E2E testability**: Playwright starts only the Next.js dev server. Proxying would require Fastify to also run during E2E tests, adding setup complexity with no functional benefit for web-only tests.
2. **Edge/SSR boundary**: Next.js API routes can set httpOnly cookies directly in the response. A Fastify proxy would require cookie forwarding plumbing.
3. **Shared interface**: Both layers implement the same `IAuthService` interface (TypeScript contract). They are not diverging implementations — they are separate adapters of the same contract.
4. **Production convergence**: In production both layers will use Supabase Auth under the hood (one via `supabase.auth.admin.*`, the other via `@supabase/ssr`), so the conceptual backend is the same.

## Consequences

- **Positive**: Simpler test setup; web routes are self-contained.
- **Negative**: Auth logic is not de-duplicated between layers. Any change to signup/login/logout validation must be mirrored in both `api/src/routes/auth.ts` and `web/app/api/auth/*/route.ts`.
- **Mitigation**: The shared `IAuthService` interface (in `api/src/services/authService.ts`) acts as the canonical contract. Both sides must satisfy it.

## Future

When adding mobile or CLI clients, they will call the Fastify API directly. The Next.js auth routes serve exclusively the browser client. This is a standard BFF pattern.
