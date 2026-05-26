import { getSkillsHandler } from "@/lib/skills/handler";
import { getProfileHandler } from "@/lib/profile/handler";
import { InMemorySessionsService } from "./service";

declare global {
  // eslint-disable-next-line no-var
  var __sessionsHandler: InMemorySessionsService | undefined;
}

export function getSessionsHandler(): InMemorySessionsService {
  if (!global.__sessionsHandler) {
    global.__sessionsHandler = new InMemorySessionsService(
      getSkillsHandler(),
      getProfileHandler()
    );
  }
  return global.__sessionsHandler;
}
