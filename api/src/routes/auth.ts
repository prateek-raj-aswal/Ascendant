import type { FastifyInstance } from "fastify";
import { type IAuthService, AuthError } from "../services/authService.js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function registerAuthRoutes(app: FastifyInstance, authService: IAuthService): void {
  app.post("/api/auth/signup", async (request, reply) => {
    const body = request.body as { email?: unknown; password?: unknown };

    if (!body.email || typeof body.email !== "string" || !EMAIL_RE.test(body.email)) {
      return reply.status(422).send({ error: "Invalid email format", field: "email" });
    }
    if (!body.password || typeof body.password !== "string" || body.password.length < 8) {
      return reply
        .status(422)
        .send({ error: "Password must be at least 8 characters", field: "password" });
    }

    try {
      const user = await authService.signup(body.email, body.password);
      return reply.status(201).send(user);
    } catch (err) {
      if (err instanceof AuthError && err.code === "DUPLICATE_EMAIL") {
        return reply.status(409).send({ error: "Email already registered" });
      }
      throw err;
    }
  });

  app.post("/api/auth/login", async (request, reply) => {
    const body = request.body as { email?: unknown; password?: unknown };

    if (!body.email || !body.password) {
      return reply.status(422).send({ error: "email and password are required" });
    }

    try {
      const result = await authService.login(
        body.email as string,
        body.password as string
      );
      return reply.status(200).send(result);
    } catch (err) {
      if (err instanceof AuthError && err.code === "INVALID_CREDENTIALS") {
        return reply.status(401).send({ error: "Invalid email or password" });
      }
      throw err;
    }
  });

  app.post("/api/auth/logout", async (request, reply) => {
    const auth = request.headers.authorization;
    if (!auth || !auth.startsWith("Bearer ")) {
      return reply.status(401).send({ error: "Unauthorized" });
    }
    const token = auth.slice(7);

    try {
      await authService.logout(token);
      return reply.status(204).send();
    } catch (err) {
      if (err instanceof AuthError && err.code === "UNAUTHORIZED") {
        return reply.status(401).send({ error: "Unauthorized" });
      }
      throw err;
    }
  });
}
