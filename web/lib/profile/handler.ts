/**
 * Web-layer profile handler factory.
 *
 * Follows the same singleton pattern as web/lib/auth/handler.ts.
 * Dev/test: InMemoryProfileService (no database required)
 * Production: swap getProfileHandler() to return a Supabase-backed service.
 */
import { InMemoryProfileService, ProfileError } from "./service";

declare global {
  // eslint-disable-next-line no-var
  var __profileHandler: InMemoryProfileService | undefined;
}

// Singleton that survives Next.js hot reloads in dev mode
export function getProfileHandler(): InMemoryProfileService {
  if (!global.__profileHandler) {
    global.__profileHandler = new InMemoryProfileService();
  }
  return global.__profileHandler;
}

export { ProfileError } from "./service";
