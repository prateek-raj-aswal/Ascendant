import type { FastifyInstance } from "fastify";
import type { IAuthService } from "../services/authService.js";
import { type IProfileService, ProfileError } from "../services/profileService.js";

/**
 * Registers the profile routes on the Fastify instance.
 *
 * Routes:
 *   POST /api/profile/onboard — create a profile for the authenticated user
 *   GET  /api/profile          — retrieve the authenticated user's profile
 *
 * Both routes require a valid Bearer token in the Authorization header.
 * Token→userId resolution uses authService.getUserId().
 *
 * @param app           - Fastify instance
 * @param profileService - Profile service (InMemoryProfileService in dev/test)
 * @param authService    - Auth service used to resolve Bearer tokens to user IDs
 */
export function registerProfileRoutes(
  app: FastifyInstance,
  profileService: IProfileService,
  authService: IAuthService
): void {
  // -------------------------------------------------------------------------
  // POST /api/profile/onboard
  // -------------------------------------------------------------------------
  app.post("/api/profile/onboard", async (request, reply) => {
    // -- Auth --
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return reply.status(401).send({ error: "Unauthorized" });
    }
    const token = authHeader.slice(7);
    const userId = authService.getUserId(token);
    if (!userId) {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    // -- Validation --
    const body = request.body as { display_name?: unknown; avatar_seed?: unknown };
    if (
      !body.display_name ||
      typeof body.display_name !== "string" ||
      body.display_name.trim().length === 0
    ) {
      return reply.status(422).send({ error: "display_name is required", field: "display_name" });
    }
    if (body.display_name.trim().length > 100) {
      return reply.status(422).send({ error: "display_name must be 100 characters or fewer", field: "display_name" });
    }

    // avatar_seed may be an empty string per contract (no minLength specified), but must be present
    if (body.avatar_seed === undefined || body.avatar_seed === null) {
      return reply.status(422).send({ error: "avatar_seed is required", field: "avatar_seed" });
    }
    const avatarSeed =
      typeof body.avatar_seed === "string" ? body.avatar_seed : String(body.avatar_seed);

    // -- Service call --
    try {
      const result = await profileService.onboard(userId, body.display_name, avatarSeed);
      return reply.status(201).send(result);
    } catch (err) {
      if (err instanceof ProfileError && err.code === "PROFILE_EXISTS") {
        return reply.status(409).send({ error: "Profile already exists for this user" });
      }
      throw err;
    }
  });

  // -------------------------------------------------------------------------
  // GET /api/profile
  // -------------------------------------------------------------------------
  app.get("/api/profile", async (request, reply) => {
    // -- Auth --
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return reply.status(401).send({ error: "Unauthorized" });
    }
    const token = authHeader.slice(7);
    const userId = authService.getUserId(token);
    if (!userId) {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    // -- Service call --
    try {
      const profile = await profileService.getProfile(userId);
      return reply.status(200).send(profile);
    } catch (err) {
      if (err instanceof ProfileError && err.code === "PROFILE_NOT_FOUND") {
        return reply.status(404).send({ error: "Profile not found" });
      }
      throw err;
    }
  });
}
