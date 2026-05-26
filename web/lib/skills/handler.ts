/**
 * Web-layer skills handler factory.
 *
 * Follows the same singleton pattern as web/lib/profile/handler.ts.
 * Dev/test: InMemorySkillsService (no database required)
 * Production: swap getSkillsHandler() to return a Supabase-backed service.
 */
import { InMemorySkillsService, SkillError } from "./service";

declare global {
  // eslint-disable-next-line no-var
  var __skillsHandler: InMemorySkillsService | undefined;
}

// Singleton that survives Next.js hot reloads in dev mode
export function getSkillsHandler(): InMemorySkillsService {
  if (!global.__skillsHandler) {
    global.__skillsHandler = new InMemorySkillsService();
  }
  return global.__skillsHandler;
}

export { SkillError } from "./service";
