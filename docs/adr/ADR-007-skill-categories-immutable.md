# ADR-007: skill_categories Is Immutable to Authenticated Users

Date: 2026-05-26
Status: Accepted

## Context

The four skill categories — Body, Mind, Craft, Spirit — are fundamental to ASCENDANT's design. They are the top-level taxonomy that all user skills, XP tracking, and UI domain rings are built around. They are seeded by the migration and are not expected to change during the lifetime of Phase 1 (or beyond).

The question was whether to allow authenticated users to modify them (e.g., add custom categories) or treat the table as a static system constant.

## Decision

`skill_categories` is read-only for the `authenticated` role. The RLS policy grants SELECT only. No INSERT, UPDATE, or DELETE policy exists. The table is populated by the migration seed and is not writable through any application path. Any future change to the categories requires a new migration.

## Consequences

- **Positive**: The four-category taxonomy is stable. All UI, XP calculations, and analytics can hardcode or cache category IDs without risk of them disappearing or changing.
- **Positive**: No permission escalation risk — a compromised user session cannot alter the global skill taxonomy.
- **Negative**: Adding or renaming a category requires a database migration and a code-level update to anything that references category names or IDs by value. This is acceptable because category changes are expected to be rare and deliberate.
- **Negative**: No user customization of top-level categories is possible within this model. If custom categories are ever required, the schema design will need to change (e.g., a separate `custom_categories` table scoped to a user).
