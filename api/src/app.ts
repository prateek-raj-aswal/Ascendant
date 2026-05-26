import Fastify from "fastify";
import { InMemoryAuthService, SupabaseAuthService } from "./services/authService.js";
import { InMemoryProfileService } from "./services/profileService.js";
import { InMemorySkillService } from "./services/skillService.js";
import { InMemorySessionService } from "./services/sessionService.js";
import { registerAuthRoutes } from "./routes/auth.js";
import { registerProfileRoutes } from "./routes/profile.js";
import { registerSkillRoutes } from "./routes/skills.js";
import { registerSessionRoutes } from "./routes/sessions.js";

function createAuthService() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (supabaseUrl && serviceRoleKey) {
    return new SupabaseAuthService(supabaseUrl, serviceRoleKey);
  }
  return new InMemoryAuthService();
}

export const app = Fastify({ logger: false });
const authService = createAuthService();
const profileService = new InMemoryProfileService();
const skillService = new InMemorySkillService();
const sessionService = new InMemorySessionService(skillService, profileService);

registerAuthRoutes(app, authService);
registerProfileRoutes(app, profileService, authService);
registerSkillRoutes(app, skillService, authService);
registerSessionRoutes(app, sessionService, authService);
