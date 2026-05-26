/**
 * Web-layer auth handler factory.
 *
 * This module is the BFF (Backend-For-Frontend) auth layer for the Next.js
 * web client. It is intentionally standalone from the Fastify API — see
 * ADR-001 (memory/decisions/adr-001-web-auth-layer.md) for the rationale.
 *
 * Dev/test: InMemoryAuthHandler (no Supabase required)
 * Production: swap getAuthHandler() to return a SupabaseAuthHandler that uses
 *   @supabase/ssr createServerClient with the service role key.
 */
import { InMemoryAuthHandler } from "./mock";

declare global {
  // eslint-disable-next-line no-var
  var __authHandler: InMemoryAuthHandler | undefined;
}

// Singleton that survives Next.js hot reloads in dev mode
export function getAuthHandler(): InMemoryAuthHandler {
  if (!global.__authHandler) {
    global.__authHandler = new InMemoryAuthHandler();
  }
  return global.__authHandler;
}

export { AuthError } from "./mock";
