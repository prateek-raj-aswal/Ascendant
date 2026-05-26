# ADR-001: Web Layer Auth Is Standalone (Not Proxying Fastify)

Date: 2026-05-26
Status: Accepted

## Context

The system has two server-side layers:

- **Fastify API** (`api/`, port 3001) — canonical REST API for data operations and programmatic access.
- **Next.js web** (`web/`, port 3002) — browser frontend with BFF API routes.

For S-001, the Next.js `/api/auth/*` routes implement their own `InMemoryAuthHandler` (dev/test) instead of proxying to the Fastify API. Both layers implement the same `IAuthService` TypeScript interface (defined in `api/src/services/authService.ts`).

## Decision

The Next.js web auth routes are standalone for the browser client. They do not proxy to Fastify.

Reasons:

1. **E2E testability** — Playwright starts only the Next.js dev server. Proxying would require Fastify to also be running during E2E tests, adding setup complexity with no functional benefit for web-only tests.
2. **Edge/SSR cookie boundary** — Next.js API routes set `httpOnly` cookies directly in the response. A Fastify proxy would require cookie forwarding plumbing.
3. **Shared interface, separate adapters** — Both layers satisfy the same `IAuthService` contract. They are not diverging implementations; they are separate adapters of the same interface.
4. **Production convergence** — In production both layers will use Supabase Auth under the hood (`supabase.auth.admin.*` on the API side, `@supabase/ssr` on the web side), so the conceptual backend is unified.

## Consequences

- **Positive**: Simpler test setup; web auth routes are self-contained and require no external process.
- **Negative**: Auth validation logic is not de-duplicated between layers. Any change to signup/login/logout validation must be mirrored in both `api/src/routes/auth.ts` and `web/app/api/auth/*/route.ts`.
- **Mitigation**: The shared `IAuthService` interface acts as the canonical contract. Both sides must satisfy it. Drift is caught at the interface boundary.

When adding mobile or CLI clients, they will call the Fastify API directly. The Next.js auth routes serve exclusively the browser client. This is a standard Backend-for-Frontend (BFF) pattern.
