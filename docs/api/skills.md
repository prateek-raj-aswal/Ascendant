# Skills API

Introduced in S-003. Manages user sub-skills organised under four fixed system categories (Body, Mind, Craft, Spirit).

## Authentication

All routes require a valid Bearer token in the `Authorization` header.

---

## GET /api/skills

Returns all four categories with the authenticated user's skills nested inside each.

**Response 200**

```json
{
  "categories": [
    {
      "id": "uuid",
      "name": "Body",
      "display_order": 1,
      "skills": [
        {
          "id": "uuid",
          "name": "Running",
          "description": "Weekly long runs",
          "current_xp": 120,
          "peak_xp": 150,
          "last_session_at": "2026-05-25T10:00:00Z"
        }
      ]
    }
  ]
}
```

`skills` is an empty array when the user has no skills under a category. `description` and `last_session_at` may be `null`.

**Errors**

| Status | Condition |
|--------|-----------|
| 401 | Missing or invalid token |

---

## POST /api/skills

Creates a new sub-skill under a category.

**Request body**

```json
{
  "category_id": "uuid",
  "name": "Running",
  "description": "Weekly long runs"
}
```

`description` is optional (max 500 chars). `name` is required (1–100 chars). `category_id` must be one of the four system category UUIDs.

**Response 201**

```json
{
  "id": "uuid",
  "category_id": "uuid",
  "name": "Running",
  "description": null,
  "current_xp": 0,
  "peak_xp": 0
}
```

**Errors**

| Status | Condition | Body |
|--------|-----------|------|
| 401 | Missing or invalid token | `{"error":"Unauthorized"}` |
| 404 | `category_id` does not match a system category | `{"error":"Category not found"}` |
| 409 | Skill name already exists in this category for this user | `{"error":"Skill name already exists under this category"}` |
| 422 | `name` is missing or blank | `{"error":"name is required","field":"name"}` |

---

## PUT /api/skills/:id

Renames or updates the description of an existing skill. At least one field must be provided.

**Request body**

```json
{
  "name": "Sprint Training",
  "description": "Updated description"
}
```

Both fields are optional individually, but the body must contain at least one.

**Response 200**

```json
{
  "id": "uuid",
  "name": "Sprint Training",
  "description": "Updated description"
}
```

**Errors**

| Status | Condition | Body |
|--------|-----------|------|
| 401 | Missing or invalid token | `{"error":"Unauthorized"}` |
| 404 | Skill not found or does not belong to user | `{"error":"Skill not found"}` |
| 409 | New name already taken in this category | `{"error":"Skill name already exists under this category"}` |
| 422 | No fields provided | `{"error":"No updatable fields provided"}` |

---

## DELETE /api/skills/:id

Deletes a skill. If the skill has session history, `?force=true` must be passed to confirm deletion of the history as well. See [ADR-005](../adr/ADR-005-skill-delete-force-param.md).

**Query parameters**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `force` | boolean | `false` | Required when the skill has session history |

**Response 204** — no body.

**Errors**

| Status | Condition | Body |
|--------|-----------|------|
| 400 | Skill has session history and `force=true` was not passed | `{"error":"Skill has session history. Pass force=true to confirm deletion."}` |
| 401 | Missing or invalid token | `{"error":"Unauthorized"}` |
| 404 | Skill not found or does not belong to user | `{"error":"Skill not found"}` |

---

## Database tables

| Table | Description |
|-------|-------------|
| `skill_categories` | Read-only system table. Four rows: Body, Mind, Craft, Spirit. Authenticated users have SELECT only; no app-layer mutations. |
| `user_skills` | One row per user sub-skill. Columns include `current_xp`, `peak_xp`, `last_session_at`. RLS enforces `user_id = auth.uid()` for all operations. Deletes cascade to `session_logs`. |

---

## Web BFF routes

The Next.js BFF mirrors the above contract for the browser client. Routes are at the same paths under the web server (port 3002). Implemented in `web/app/api/skills/route.ts` and `web/app/api/skills/[id]/route.ts`. The BFF uses `InMemorySkillsService` (`web/lib/skills/service.ts`) in dev/test; the Supabase adapter replaces it in production.
