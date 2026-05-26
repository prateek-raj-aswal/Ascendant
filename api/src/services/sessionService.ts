import { randomUUID } from "crypto";
import { type ISkillService, SkillError } from "./skillService.js";
import { type IProfileService } from "./profileService.js";

export interface LogSessionInput {
  userId: string;
  skillId: string;
  durationMinutes: number;
  difficultyMultiplier: number;
  notes?: string;
}

export interface LogSessionResult {
  session_id: string;
  xp_earned: number;
  new_skill_xp: number;
  new_total_xp: number;
}

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

export interface ISessionService {
  logSession(input: LogSessionInput): Promise<LogSessionResult>;
  getSessions(
    userId: string,
    skillId?: string,
    limit?: number,
    offset?: number
  ): Promise<{ sessions: SessionEntry[]; total: number }>;
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

export class InMemorySessionService implements ISessionService {
  private sessions = new Map<string, StoredSession>();

  constructor(
    private readonly skillService: ISkillService,
    private readonly profileService: IProfileService
  ) {}

  async logSession(input: LogSessionInput): Promise<LogSessionResult> {
    const { userId, skillId, durationMinutes, difficultyMultiplier, notes } = input;

    if (durationMinutes < 1 || durationMinutes > 480) {
      throw new SessionError("duration_minutes must be between 1 and 480", "INVALID_DURATION");
    }

    if (!VALID_DIFFICULTY.has(difficultyMultiplier)) {
      throw new SessionError(
        "difficulty_multiplier must be one of 0.5, 1.0, 1.5, 2.0",
        "INVALID_DIFFICULTY"
      );
    }

    const skill = await this.skillService.getSkillById(userId, skillId);
    if (!skill) {
      throw new SessionError("Skill not found", "SKILL_NOT_FOUND");
    }

    const xpEarned = Math.floor(durationMinutes * difficultyMultiplier);

    const xpUpdate = await this.skillService.applySessionXP(userId, skillId, xpEarned);
    const newTotalXP = await this.profileService.addTotalXP(userId, xpEarned);

    const sessionId = randomUUID();
    const session: StoredSession = {
      id: sessionId,
      user_id: userId,
      skill_id: skillId,
      skill_name: skill.name,
      duration_minutes: durationMinutes,
      difficulty_multiplier: difficultyMultiplier,
      xp_earned: xpEarned,
      notes: notes ?? null,
      logged_at: new Date().toISOString(),
    };

    this.sessions.set(sessionId, session);

    return {
      session_id: sessionId,
      xp_earned: xpEarned,
      new_skill_xp: xpUpdate.new_current_xp,
      new_total_xp: newTotalXP,
    };
  }

  async getSessions(
    userId: string,
    skillId?: string,
    limit = 20,
    offset = 0
  ): Promise<{ sessions: SessionEntry[]; total: number }> {
    const all = Array.from(this.sessions.values())
      .filter((s) => s.user_id === userId)
      .filter((s) => (skillId ? s.skill_id === skillId : true))
      .sort((a, b) => b.logged_at.localeCompare(a.logged_at));

    const total = all.length;
    const page = all.slice(offset, offset + limit).map(({ user_id: _, ...rest }) => rest);

    return { sessions: page, total };
  }
}
