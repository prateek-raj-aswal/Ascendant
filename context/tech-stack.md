# Tech Stack

## Frontend
- Framework: Next.js 15
- Language: TypeScript
- Styling: Tailwind CSS

## Backend
- Runtime: Node.js
- Framework: Fastify
- Auth: Supabase Auth

## Infrastructure (Local Development)
- **All databases and caches run via Docker Desktop** — no native installs
- PostgreSQL: `docker` container (primary database)
- Redis: `docker` container (caching, session store, queue)
- Docker Compose manages all local service orchestration
- A `docker-compose.yml` at the repo root is the single source of truth for local infra

## Infrastructure (Production)
- PostgreSQL: managed cloud instance (e.g. Supabase DB or Railway)
- Redis: managed cloud instance (e.g. Upstash or Railway)
- Deployment target: TBD (cloud-agnostic — Docker images ship to any provider)

## AI
- Provider: Anthropic Claude API
- Model: claude-sonnet-4-6 (default), upgrade path to claude-opus-4-7 for paid tier
- Usage: user-initiated chat (reactive, not proactive)

## Constraints
- No local native installs for DB or cache — Docker Desktop is required for local dev
- All environment secrets via `.env.local` (never committed)
- Docker images must not run as root
- No `:latest` tags in Docker Compose — pin explicit versions
