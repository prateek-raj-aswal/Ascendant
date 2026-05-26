import type { FastifyInstance } from "fastify";
import type { IAuthService } from "../services/authService.js";
import { type ISessionService, SessionError } from "../services/sessionService.js";

export function registerSessionRoutes(
  app: FastifyInstance,
  sessionService: ISessionService,
  authService: IAuthService
): void {
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

  // POST /api/sessions — log a training session
  app.post("/api/sessions", async (request, reply) => {
    const userId = resolveUserId(request, reply);
    if (!userId) return;

    const body = request.body as {
      skill_id?: unknown;
      duration_minutes?: unknown;
      difficulty_multiplier?: unknown;
      notes?: unknown;
    };

    try {
      const result = await sessionService.logSession({
        userId,
        skillId: typeof body.skill_id === "string" ? body.skill_id : "",
        durationMinutes: typeof body.duration_minutes === "number" ? body.duration_minutes : 0,
        difficultyMultiplier:
          typeof body.difficulty_multiplier === "number" ? body.difficulty_multiplier : 0,
        notes: typeof body.notes === "string" ? body.notes : undefined,
      });

      return reply.status(201).send(result);
    } catch (err) {
      if (err instanceof SessionError) {
        if (err.code === "INVALID_DURATION") {
          return reply.status(400).send({ error: "INVALID_DURATION" });
        }
        if (err.code === "INVALID_DIFFICULTY") {
          return reply.status(400).send({ error: "INVALID_DIFFICULTY" });
        }
        if (err.code === "SKILL_NOT_FOUND") {
          return reply.status(404).send({ error: "SKILL_NOT_FOUND" });
        }
      }
      throw err;
    }
  });

  // GET /api/sessions — list sessions, optionally filtered by skill_id
  app.get("/api/sessions", async (request, reply) => {
    const userId = resolveUserId(request, reply);
    if (!userId) return;

    const query = request.query as {
      skill_id?: string;
      limit?: string;
      offset?: string;
    };

    const limit = Math.min(parseInt(query.limit ?? "20", 10) || 20, 100);
    const offset = parseInt(query.offset ?? "0", 10) || 0;

    const result = await sessionService.getSessions(userId, query.skill_id, limit, offset);
    return reply.status(200).send(result);
  });
}
