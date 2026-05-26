// ---------------------------------------------------------------------------
// Contract types — derived from S-003 contracts.json
// ---------------------------------------------------------------------------

export interface SkillCategory {
  id: string;
  name: string;
  display_order: number;
}

export interface UserSkill {
  id: string;
  category_id: string;
  user_id: string;
  name: string;
  description: string | null;
  current_xp: number;
  peak_xp: number;
  last_session_at: string | null;
  /** Internal flag — not exposed in API responses */
  has_history: boolean;
}

export interface SkillCategoryWithSkills {
  id: string;
  name: string;
  display_order: number;
  skills: Array<{
    id: string;
    name: string;
    description: string | null;
    current_xp: number;
    peak_xp: number;
    last_session_at: string | null;
  }>;
}

export interface CreateSkillInput {
  user_id: string;
  category_id: string;
  name: string;
  description?: string;
}

export interface UpdateSkillInput {
  name?: string;
  description?: string;
}

// ---------------------------------------------------------------------------
// Error
// ---------------------------------------------------------------------------

export class SkillError extends Error {
  constructor(
    message: string,
    public readonly code: string
  ) {
    super(message);
    this.name = "SkillError";
  }
}

// ---------------------------------------------------------------------------
// Deterministic category UUIDs (system-wide constants)
// ---------------------------------------------------------------------------

export const CATEGORY_IDS = {
  Body: "00000000-0000-0000-0000-000000000001",
  Mind: "00000000-0000-0000-0000-000000000002",
  Craft: "00000000-0000-0000-0000-000000000003",
  Spirit: "00000000-0000-0000-0000-000000000004",
} as const;

const SYSTEM_CATEGORIES: SkillCategory[] = [
  { id: CATEGORY_IDS.Body, name: "Body", display_order: 1 },
  { id: CATEGORY_IDS.Mind, name: "Mind", display_order: 2 },
  { id: CATEGORY_IDS.Craft, name: "Craft", display_order: 3 },
  { id: CATEGORY_IDS.Spirit, name: "Spirit", display_order: 4 },
];

// ---------------------------------------------------------------------------
// In-memory implementation (dev/test)
// ---------------------------------------------------------------------------

let skillIdCounter = 1;

function generateSkillId(): string {
  const n = skillIdCounter++;
  return `skill-${Date.now()}-${n}`;
}

export class InMemorySkillsService {
  private skills = new Map<string, UserSkill>();

  getCategories(userId: string): SkillCategoryWithSkills[] {
    const userSkills = Array.from(this.skills.values()).filter(
      (s) => s.user_id === userId
    );

    return SYSTEM_CATEGORIES.map((cat) => ({
      id: cat.id,
      name: cat.name,
      display_order: cat.display_order,
      skills: userSkills
        .filter((s) => s.category_id === cat.id)
        .map(({ id, name, description, current_xp, peak_xp, last_session_at }) => ({
          id,
          name,
          description,
          current_xp,
          peak_xp,
          last_session_at,
        })),
    }));
  }

  createSkill(input: CreateSkillInput): UserSkill {
    const { user_id, category_id, name, description } = input;

    const validCategory = SYSTEM_CATEGORIES.find((c) => c.id === category_id);
    if (!validCategory) {
      throw new SkillError("Category not found", "CATEGORY_NOT_FOUND");
    }

    if (!name || name.trim().length === 0) {
      throw new SkillError("name is required", "NAME_REQUIRED");
    }

    // Check for duplicate name within same user+category
    const duplicate = Array.from(this.skills.values()).find(
      (s) => s.user_id === user_id && s.category_id === category_id && s.name === name.trim()
    );
    if (duplicate) {
      throw new SkillError("Skill name already exists under this category", "SKILL_NAME_EXISTS");
    }

    const skill: UserSkill = {
      id: generateSkillId(),
      user_id,
      category_id,
      name: name.trim(),
      description: description?.trim() ?? null,
      current_xp: 0,
      peak_xp: 0,
      last_session_at: null,
      has_history: false,
    };

    this.skills.set(skill.id, skill);
    return skill;
  }

  updateSkill(skillId: string, userId: string, input: UpdateSkillInput): UserSkill {
    const skill = this.skills.get(skillId);
    if (!skill || skill.user_id !== userId) {
      throw new SkillError("Skill not found", "SKILL_NOT_FOUND");
    }

    if (input.name === undefined && input.description === undefined) {
      throw new SkillError("No updatable fields provided", "NO_FIELDS");
    }

    if (input.name !== undefined) {
      const trimmed = input.name.trim();
      // Check for duplicate name in same category (excluding itself)
      const duplicate = Array.from(this.skills.values()).find(
        (s) =>
          s.user_id === userId &&
          s.category_id === skill.category_id &&
          s.name === trimmed &&
          s.id !== skillId
      );
      if (duplicate) {
        throw new SkillError("Skill name already exists under this category", "SKILL_NAME_EXISTS");
      }
      skill.name = trimmed;
    }

    if (input.description !== undefined) {
      skill.description = input.description.trim() || null;
    }

    this.skills.set(skillId, skill);
    return skill;
  }

  deleteSkill(skillId: string, userId: string, force: boolean): void {
    const skill = this.skills.get(skillId);
    if (!skill || skill.user_id !== userId) {
      throw new SkillError("Skill not found", "SKILL_NOT_FOUND");
    }

    if (skill.has_history && !force) {
      throw new SkillError(
        "Skill has session history. Pass force=true to confirm deletion.",
        "HAS_HISTORY"
      );
    }

    this.skills.delete(skillId);
  }

  addXP(
    skillId: string,
    userId: string,
    xpEarned: number
  ): { new_current_xp: number; new_peak_xp: number; skill_name: string } | null {
    const skill = this.skills.get(skillId);
    if (!skill || skill.user_id !== userId) return null;
    skill.current_xp += xpEarned;
    skill.peak_xp = Math.max(skill.peak_xp, skill.current_xp);
    skill.last_session_at = new Date().toISOString();
    skill.has_history = true;
    this.skills.set(skillId, skill);
    return { new_current_xp: skill.current_xp, new_peak_xp: skill.peak_xp, skill_name: skill.name };
  }

  seedHistory(skillId: string): void {
    const skill = this.skills.get(skillId);
    if (!skill) {
      throw new SkillError("Skill not found", "SKILL_NOT_FOUND");
    }
    skill.has_history = true;
    this.skills.set(skillId, skill);
  }
}
