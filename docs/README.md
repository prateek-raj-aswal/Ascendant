# ASCENDANT — Documentation Index

## Database

| Resource | Doc |
|---|---|
| Phase 1 schema (user_profiles, skill_categories, user_skills, session_logs) | [docs/api/database-schema.md](api/database-schema.md) |
| Migration file | [db/migrations/001_phase1_schema.sql](../db/migrations/001_phase1_schema.sql) |

## Architecture Decision Records

| # | Title | Story |
|---|---|---|
| ADR-001 | [Web layer auth is standalone (not proxying Fastify)](adr/ADR-001-web-auth-standalone.md) | S-001 |
| ADR-002 | [Profile ID equals user ID](adr/ADR-002-profile-id-equals-user-id.md) | S-002 |
| ADR-003 | [Web BFF profile service](adr/ADR-003-web-bff-profile-service.md) | S-003 |
| ADR-004 | [SupabaseAuthService.getUserId() throws NotImplementedError](adr/ADR-004-supabase-get-user-id-throws.md) | S-003 |
| ADR-005 | [RLS enforced at the database layer](adr/ADR-005-rls-at-database-layer.md) | S-006 |
| ADR-006 | [session_logs has no direct DELETE policy](adr/ADR-006-session-logs-no-delete-policy.md) | S-006 |
| ADR-007 | [skill_categories is immutable to authenticated users](adr/ADR-007-skill-categories-immutable.md) | S-006 |
