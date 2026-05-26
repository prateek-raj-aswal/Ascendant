import type { FastifyInstance } from "fastify";
import type { IAuthService } from "../services/authService.js";
import { type ISkillService, SkillError } from "../services/skillService.js";

/**
 * Registers the skill routes on the Fastify instance.
 *
 * Routes:
 *   GET    /api/skills                        — list all categories with user's skills
 *   POST   /api/skills                        — create a new skill under a category
 *   PUT    /api/skills/:id                    — update a skill's name or description
 *   DELETE /api/skills/:id                    — delete a skill (force=true required if history exists)
 *
 * Test-only (non-production):
 *   POST   /api/skills/:id/test-seed-history  — simulate session history for a skill
 *
 * All routes except the test-seed route require a valid Bearer token.
 *
 * @param app          - Fastify instance
 * @param skillService - Skill service (InMemorySkillService in dev/test)
 * @param authService  - Auth service used to resolve Bearer tokens to user IDs
 */
export function registerSkillRoutes(
  app: FastifyInstance,
  skillService: ISkillService,
  authService: IAuthService
): void {
  // -------------------------------------------------------------------------
  // Auth helper — extracts and validates the Bearer token, returning userId.
  // Returns undefined and sends a 401 response when the token is missing or invalid.
  // -------------------------------------------------------------------------
  function resolveUserId(
    request: Parameters<Parameters<FastifyInstance["get"]>[1]>[0],
    reply: Parameters<Parameters<FastifyInstance["get"]>[1]>[1]
  ): string | undefined {
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      reply.status(401).send({ error: "Unauthorized" });
      return undefined;
    }
    const token = authHeader.slice(7);
    const userId = authService.getUserId(token);
    if (!userId) {
      reply.status(401).send({ error: "Unauthorized" });
      return undefined;
    }
    return userId;
  }

  // -------------------------------------------------------------------------
  // GET /api/skills — return all four categories with the caller's skills nested
  // -------------------------------------------------------------------------
  app.get("/api/skills", async (request, reply) => {
    const userId = resolveUserId(request, reply);
    if (!userId) return;

    const categories = await skillService.getCategories(userId);
    return reply.status(200).send({ categories });
  });

  // -------------------------------------------------------------------------
  // POST /api/skills — create a new skill under a system category
  // -------------------------------------------------------------------------
  app.post("/api/skills", async (request, reply) => {
    const userId = resolveUserId(request, reply);
    if (!userId) return;

    const body = request.body as {
      category_id?: unknown;
      name?: unknown;
      description?: unknown;
    };

    // -- Validate required fields --
    if (!body.name || typeof body.name !== "string" || body.name.trim().length === 0) {
      return reply.status(422).send({ error: "name is required", field: "name" });
    }
    if (body.name.trim().length > 100) {
      return reply.status(422).send({ error: "name must be 100 characters or fewer", field: "name" });
    }

    const categoryId =
      typeof body.category_id === "string" ? body.category_id : String(body.category_id ?? "");
    const name = body.name.trim();
    const description =
      body.description !== undefined && body.description !== null
        ? String(body.description)
        : undefined;

    try {
      const skill = await skillService.createSkill(userId, categoryId, name, description);
      return reply.status(201).send(skill);
    } catch (err) {
      if (err instanceof SkillError) {
        if (err.code === "CATEGORY_NOT_FOUND") {
          return reply.status(404).send({ error: "Category not found" });
        }
        if (err.code === "DUPLICATE_NAME") {
          return reply.status(409).send({ error: "Skill name already exists under this category" });
        }
      }
      throw err;
    }
  });

  // -------------------------------------------------------------------------
  // PUT /api/skills/:id — update a skill's name and/or description
  // -------------------------------------------------------------------------
  app.put("/api/skills/:id", async (request, reply) => {
    const userId = resolveUserId(request, reply);
    if (!userId) return;

    const { id: skillId } = request.params as { id: string };
    const body = request.body as { name?: unknown; description?: unknown };

    // Require at least one updatable field to be present.
    const hasName = body.name !== undefined;
    const hasDescription = body.description !== undefined;
    if (!hasName && !hasDescription) {
      return reply.status(422).send({ error: "No updatable fields provided" });
    }

    const updates: { name?: string; description?: string } = {};
    if (hasName) {
      if (typeof body.name !== "string" || body.name.trim().length === 0) {
        return reply.status(422).send({ error: "name must be a non-empty string", field: "name" });
      }
      if (body.name.trim().length > 100) {
        return reply.status(422).send({ error: "name must be 100 characters or fewer", field: "name" });
      }
      updates.name = body.name.trim();
    }
    if (hasDescription) {
      updates.description = body.description !== null ? String(body.description) : "";
    }

    try {
      const result = await skillService.updateSkill(userId, skillId, updates);
      return reply.status(200).send(result);
    } catch (err) {
      if (err instanceof SkillError) {
        if (err.code === "SKILL_NOT_FOUND") {
          return reply.status(404).send({ error: "Skill not found" });
        }
        if (err.code === "DUPLICATE_NAME") {
          return reply.status(409).send({ error: "Skill name already exists under this category" });
        }
      }
      throw err;
    }
  });

  // -------------------------------------------------------------------------
  // DELETE /api/skills/:id — delete a skill; force=true bypasses history guard
  // -------------------------------------------------------------------------
  app.delete("/api/skills/:id", async (request, reply) => {
    const userId = resolveUserId(request, reply);
    if (!userId) return;

    const { id: skillId } = request.params as { id: string };
    // Accept force=true as a query param string; any other value treats as false.
    const query = request.query as { force?: string };
    const force = query.force === "true";

    try {
      await skillService.deleteSkill(userId, skillId, force);
      return reply.status(204).send();
    } catch (err) {
      if (err instanceof SkillError) {
        if (err.code === "SKILL_NOT_FOUND") {
          return reply.status(404).send({ error: "Skill not found" });
        }
        if (err.code === "HAS_HISTORY") {
          return reply.status(400).send({
            error: "Skill has session history. Pass force=true to confirm deletion.",
          });
        }
      }
      throw err;
    }
  });

  // -------------------------------------------------------------------------
  // TEST-ONLY: POST /api/skills/:id/test-seed-history
  // Simulates session history on a skill so DELETE tests can exercise the
  // history-guard without a full sessions API being present.
  // Registered only when NODE_ENV !== 'production' so it never ships live.
  // -------------------------------------------------------------------------
  if (process.env.NODE_ENV !== "production") {
    app.post("/api/skills/:id/test-seed-history", async (request, reply) => {
      const { id: skillId } = request.params as { id: string };

      try {
        await skillService.seedHistory(skillId);
        return reply.status(200).send({ ok: true });
      } catch (err) {
        if (err instanceof SkillError && err.code === "SKILL_NOT_FOUND") {
          return reply.status(404).send({ error: "Skill not found" });
        }
        throw err;
      }
    });
  }
}
