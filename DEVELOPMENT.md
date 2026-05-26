# ASCENDANT — Development Guide

ASCENDANT is a Life Progression OS: a gamified self-improvement tracker built on Next.js 15 (web + BFF), Fastify (REST API), and Supabase Auth. Users log training sessions, accumulate XP across skill domains, and advance through class tiers.

## Prerequisites

- **Node.js** 20+
- **Docker Desktop** — required for Postgres and Redis when running the full stack locally (not needed for unit tests or auth E2E tests)

## Monorepo structure

```
web/    Next.js 15 app (port 3002)
api/    Fastify REST API (port 3001)
```

Both workspaces are managed from the root via npm workspaces.

## Running in development

```bash
# Both servers
npm run dev

# Web only
npm run dev:web

# API only
npm run dev:api
```

## Running tests

**API unit tests** (Vitest, no external dependencies):

```bash
npm run test:api
```

**E2E tests** (Playwright, Chromium):

```bash
npm run test:e2e
```

Playwright starts the Next.js dev server automatically on port 3002. No Fastify process or database is required for E2E auth tests — the web layer uses `InMemoryAuthHandler` in test/dev mode.

## Port assignments

| Service       | Port |
|---------------|------|
| Next.js web   | 3002 |
| Fastify API   | 3001 |

Port 3002 is used for the web dev server (instead of the Next.js default 3000) to avoid conflicts with other Docker containers that may occupy port 3000.

## Auth in development and tests

The web `/api/auth/*` routes back onto `InMemoryAuthHandler` when no Supabase credentials are configured. This means signup, login, and logout work in tests without a live Supabase project. State is in-process and resets on server restart.

In production, both the web BFF and Fastify API use Supabase Auth (`@supabase/ssr` and `supabase.auth.admin.*` respectively). See [ADR-001](docs/adr/ADR-001-web-auth-standalone.md) for the reasoning behind keeping web auth standalone from the Fastify layer.

## Profile API routes

The web BFF exposes two profile routes (both require an authenticated session cookie):

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/profile/onboard` | Create a new profile (name, avatar seed, class defaults to `shadow_novice`) |
| `GET` | `/api/profile` | Fetch the current user's profile |

`POST /api/profile/onboard` returns `201` on success, `409` if a profile already exists, and `422` if `display_name` is blank.

`GET /api/profile` returns `404` if onboarding has not been completed.

### Onboarding flow

A new user who has registered but has no profile is redirected from any protected page to `/onboarding` by `OnboardingGuard`. After submitting the onboarding form (`display_name` + `avatar_seed`), the app `POST`s to `/api/profile/onboard` and redirects to `/dashboard` on success.

## Profile service in development and tests

The web layer uses `web/lib/profile/service.ts` (`InMemoryProfileService`) and `web/lib/profile/handler.ts` (singleton via `global.__profileHandler`) when no Supabase credentials are configured. Playwright E2E tests covering onboarding and profile pages work with no Fastify process or database running. This is the same BFF isolation pattern as auth. See [ADR-003](docs/adr/ADR-003-web-bff-profile-service.md).

## Skills API routes

The web BFF exposes four skill routes (all require an authenticated session cookie):

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/skills` | List all four categories with the user's sub-skills and XP values |
| `POST` | `/api/skills` | Create a new sub-skill under a category |
| `PUT` | `/api/skills/:id` | Rename or update the description of a sub-skill |
| `DELETE` | `/api/skills/:id` | Delete a sub-skill; requires `?force=true` if session history exists |

Full request/response shapes and error codes: [docs/api/skills.md](docs/api/skills.md).

The skill tree is available at `/skills`. The four categories (Body, Mind, Craft, Spirit) are system-defined and cannot be created or deleted by users.

### Skill service in development and tests

The web layer uses `web/lib/skills/service.ts` (`InMemorySkillsService`) and `web/lib/skills/handler.ts` in dev/test mode. Playwright E2E tests run against this in-memory implementation with no Fastify process or database required. See [ADR-003](docs/adr/ADR-003-web-bff-profile-service.md) for the BFF isolation pattern.

## Architecture decision records

| ADR | Decision |
|-----|----------|
| [ADR-001](docs/adr/ADR-001-web-auth-standalone.md) | Web auth routes are standalone (BFF pattern, not proxying Fastify) |
| [ADR-002](docs/adr/ADR-002-profile-id-equals-user-id.md) | `user_profiles.id` equals the auth user UUID (no separate PK) |
| [ADR-003](docs/adr/ADR-003-web-bff-profile-service.md) | Web profile routes are standalone (same BFF pattern as ADR-001) |
| [ADR-004](docs/adr/ADR-004-supabase-get-user-id-throws.md) | `SupabaseAuthService.getUserId()` throws `NotImplementedError` until async JWT verification is implemented |
| [ADR-005](docs/adr/ADR-005-skill-delete-force-param.md) | Skill delete requires `force=true` when session history exists — safety enforced at the API layer, not only in the frontend |
