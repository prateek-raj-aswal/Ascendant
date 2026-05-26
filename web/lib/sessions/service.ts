import { type InMemorySkillsService } from "@/lib/skills/service";
import { type InMemoryProfileService } from "@/lib/profile/service";

export interface SessionEntry {
  id: string;
  skill_id: string;
  skill_name: string;
  duration_minutes: number;
  difficulty_multiplier: number;
  xp_earned: number;
  notes: string | null;
  logged_at: string;
}

export interface LogSessionInput {
  user_id: string;
  skill_id: string;
  duration_minutes: number;
  difficulty_multiplier: number;
  notes?: string;
}

export interface LogSessionResult {
  session_id: string;
  xp_earned: number;
  new_skill_xp: number;
  new_total_xp: number;
}

export class SessionError extends Error {
  constructor(
    message: string,
    public readonly code: string
  ) {
    super(message);
    this.name = "SessionError";
  }
}

const VALID_DIFFICULTY = new Set([0.5, 1.0, 1.5, 2.0]);

interface StoredSession extends SessionEntry {
  user_id: string;
}

let idCounter = 1;

function generateId(): string {
  return `session-${Date.now()}-${idCounter++}`;
}

export class InMemorySessionsService {
  private sessions = new Map<string, StoredSession>();

  constructor(
    private readonly skillsService: InMemorySkillsService,
    private readonly profileService: InMemoryProfileService
  ) {}

  logSession(input: LogSessionInput): LogSessionResult {
    const { user_id, skill_id, duration_minutes, difficulty_multiplier, notes } = input;

    if (duration_minutes < 1 || duration_minutes > 480) {
      throw new SessionError("duration_minutes must be between 1 and 480", "INVALID_DURATION");
    }

    if (!VALID_DIFFICULTY.has(difficulty_multiplier)) {
      throw new SessionError("Invalid difficulty_multiplier", "INVALID_DIFFICULTY");
    }

    const xpEarned = Math.floor(duration_minutes * difficulty_multiplier);
    const result = this.skillsService.addXP(skill_id, user_id, xpEarned);
    if (!result) throw new SessionError("Skill not found", "SKILL_NOT_FOUND");

    const newTotalXP = this.profileService.addTotalXP(user_id, xpEarned);

    const sessionId = generateId();
    const session: StoredSession = {
      id: sessionId,
      user_id,
      skill_id,
      skill_name: result.skill_name,
      duration_minutes,
      difficulty_multiplier,
      xp_earned: xpEarned,
      notes: notes ?? null,
      logged_at: new Date().toISOString(),
    };

    this.sessions.set(sessionId, session);

    return {
      session_id: sessionId,
      xp_earned: xpEarned,
      new_skill_xp: result.new_current_xp,
      new_total_xp: newTotalXP,
    };
  }

  getSessions(
    user_id: string,
    skill_id?: string,
    limit = 20,
    offset = 0
  ): { sessions: SessionEntry[]; total: number } {
    const all = Array.from(this.sessions.values())
      .filter((s) => s.user_id === user_id)
      .filter((s) => (skill_id ? s.skill_id === skill_id : true))
      .sort((a, b) => b.logged_at.localeCompare(a.logged_at));

    const total = all.length;
    const page = all.slice(offset, offset + limit).map(({ user_id: _, ...rest }) => rest);

    return { sessions: page, total };
  }
}
