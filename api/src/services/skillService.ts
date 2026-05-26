import { randomUUID } from "crypto";

/** One of the four system-defined skill categories (fixed, not user-created). */
export interface SkillCategory {
  id: string;
  name: string;
  display_order: number;
}

/** A user-owned sub-skill stored under a category. */
export interface Skill {
  id: string;
  user_id: string;
  category_id: string;
  name: string;
  /** Optional free-text description; null when not provided. */
  description: string | null;
  current_xp: number;
  peak_xp: number;
  last_session_at: string | null;
  /**
   * Internal flag — tracks whether this skill has associated session history.
   * Used to guard against accidental destructive deletions. Not exposed in API responses.
   */
  has_history: boolean;
}

/** Category with its owned skills nested — shape returned by GET /api/skills. */
export interface CategoryWithSkills extends SkillCategory {
  skills: Omit<Skill, "user_id" | "has_history">[];
}

export interface SkillXPUpdate {
  new_current_xp: number;
  new_peak_xp: number;
}

export interface ISkillService {
  /**
   * Returns the four system categories, each with the requesting user's skills nested inside.
   * Categories are always returned in ascending display_order (1–4).
   *
   * @param userId - The authenticated user's id
   * @returns Array of four categories with their skills
   */
  getCategories(userId: string): Promise<CategoryWithSkills[]>;

  /**
   * Creates a new skill under an existing category for the given user.
   * Validates that the category exists and that the name is unique per user per category.
   *
   * @param userId      - The authenticated user's id
   * @param categoryId  - UUID of the target skill category
   * @param name        - Skill name (1–100 chars, already validated by route layer)
   * @param description - Optional description (max 500 chars)
   * @returns The created skill (without internal has_history field)
   * @throws SkillError("CATEGORY_NOT_FOUND") if categoryId is unknown
   * @throws SkillError("DUPLICATE_NAME") if name already exists for this user in this category
   */
  createSkill(
    userId: string,
    categoryId: string,
    name: string,
    description?: string
  ): Promise<Omit<Skill, "user_id" | "has_history" | "last_session_at">>;

  /**
   * Updates an existing skill's name and/or description.
   * Only updates fields that are present in the `updates` object.
   * Enforces ownership: a user can only update their own skills.
   *
   * @param userId   - The authenticated user's id
   * @param skillId  - UUID of the skill to update
   * @param updates  - Object with at least one of: name, description
   * @returns The updated skill subset (id, name, description)
   * @throws SkillError("SKILL_NOT_FOUND") if skill does not exist or is not owned by userId
   * @throws SkillError("DUPLICATE_NAME") if the new name conflicts with another skill in the same category
   */
  updateSkill(
    userId: string,
    skillId: string,
    updates: { name?: string; description?: string }
  ): Promise<{ id: string; name: string; description: string | null }>;

  /**
   * Deletes a skill owned by the given user.
   * When `force` is false (default), deletion is blocked if the skill has session history.
   *
   * @param userId   - The authenticated user's id
   * @param skillId  - UUID of the skill to delete
   * @param force    - If true, delete even when session history exists
   * @throws SkillError("SKILL_NOT_FOUND") if skill does not exist or is not owned by userId
   * @throws SkillError("HAS_HISTORY") if skill has session history and force is false
   */
  deleteSkill(userId: string, skillId: string, force: boolean): Promise<void>;

  /**
   * Returns basic skill info if skillId belongs to userId, null otherwise.
   * Used by the session service to validate skill ownership.
   */
  getSkillById(
    userId: string,
    skillId: string
  ): Promise<{ id: string; name: string; current_xp: number; peak_xp: number } | null>;

  /**
   * Applies XP earned from a session to the skill and marks it as having history.
   * @throws SkillError("SKILL_NOT_FOUND") if skill does not exist or is not owned by userId
   */
  applySessionXP(userId: string, skillId: string, xpEarned: number): Promise<SkillXPUpdate>;

  /**
   * TEST-ONLY: Marks a skill as having session history without going through the sessions API.
   * This exposes an internal testing surface so unit tests can exercise the history-guard
   * on DELETE without needing a full sessions implementation.
   *
   * @param skillId - UUID of the skill to mark
   * @throws SkillError("SKILL_NOT_FOUND") if the skill does not exist
   */
  seedHistory(skillId: string): Promise<void>;
}

/** Domain error for skill-related failures; carries a machine-readable code. */
export class SkillError extends Error {
  constructor(
    message: string,
    public readonly code: string
  ) {
    super(message);
    this.name = "SkillError";
  }
}

/**
 * Deterministic UUIDs for the four system categories.
 * These are stable constants so tests and seeds can reference them by value.
 */
const CATEGORY_BODY_ID = "00000000-0000-0000-0000-000000000001";
const CATEGORY_MIND_ID = "00000000-0000-0000-0000-000000000002";
const CATEGORY_CRAFT_ID = "00000000-0000-0000-0000-000000000003";
const CATEGORY_SPIRIT_ID = "00000000-0000-0000-0000-000000000004";

/** The four immutable system categories, ordered by display_order. */
const SYSTEM_CATEGORIES: SkillCategory[] = [
  { id: CATEGORY_BODY_ID, name: "Body", display_order: 1 },
  { id: CATEGORY_MIND_ID, name: "Mind", display_order: 2 },
  { id: CATEGORY_CRAFT_ID, name: "Craft", display_order: 3 },
  { id: CATEGORY_SPIRIT_ID, name: "Spirit", display_order: 4 },
];

/** Set of valid category IDs for fast membership checks. */
const VALID_CATEGORY_IDS = new Set(SYSTEM_CATEGORIES.map((c) => c.id));

export class InMemorySkillService implements ISkillService {
  /** All skills for all users; keyed by skill id for O(1) lookup. */
  private skills = new Map<string, Skill>();

  async getCategories(userId: string): Promise<CategoryWithSkills[]> {
    // Collect this user's skills grouped by category_id.
    const byCategory = new Map<string, Omit<Skill, "user_id" | "has_history">[]>();
    for (const cat of SYSTEM_CATEGORIES) {
      byCategory.set(cat.id, []);
    }

    for (const skill of this.skills.values()) {
      if (skill.user_id !== userId) continue;
      const bucket = byCategory.get(skill.category_id);
      if (!bucket) continue; // orphaned skill — skip (should not happen)
      bucket.push({
        id: skill.id,
        category_id: skill.category_id,
        name: skill.name,
        description: skill.description,
        current_xp: skill.current_xp,
        peak_xp: skill.peak_xp,
        last_session_at: skill.last_session_at,
      });
    }

    // Return categories in display_order (SYSTEM_CATEGORIES is already sorted).
    return SYSTEM_CATEGORIES.map((cat) => ({
      ...cat,
      skills: byCategory.get(cat.id) ?? [],
    }));
  }

  async createSkill(
    userId: string,
    categoryId: string,
    name: string,
    description?: string
  ): Promise<Omit<Skill, "user_id" | "has_history" | "last_session_at">> {
    if (!VALID_CATEGORY_IDS.has(categoryId)) {
      throw new SkillError("Category not found", "CATEGORY_NOT_FOUND");
    }

    // Duplicate name check: case-sensitive, scoped to this user + category.
    const isDuplicate = this.findUserSkillByName(userId, categoryId, name) !== undefined;
    if (isDuplicate) {
      throw new SkillError(
        "Skill name already exists under this category",
        "DUPLICATE_NAME"
      );
    }

    const skill: Skill = {
      id: randomUUID(),
      user_id: userId,
      category_id: categoryId,
      name,
      description: description ?? null,
      current_xp: 0,
      peak_xp: 0,
      last_session_at: null,
      has_history: false,
    };

    this.skills.set(skill.id, skill);

    return {
      id: skill.id,
      category_id: skill.category_id,
      name: skill.name,
      description: skill.description,
      current_xp: skill.current_xp,
      peak_xp: skill.peak_xp,
    };
  }

  async updateSkill(
    userId: string,
    skillId: string,
    updates: { name?: string; description?: string }
  ): Promise<{ id: string; name: string; description: string | null }> {
    const skill = this.skills.get(skillId);
    // Treat not-found and wrong-owner identically to avoid user enumeration.
    if (!skill || skill.user_id !== userId) {
      throw new SkillError("Skill not found", "SKILL_NOT_FOUND");
    }

    if (updates.name !== undefined) {
      // Only check duplicate if the name is actually changing.
      if (updates.name !== skill.name) {
        const conflict = this.findUserSkillByName(userId, skill.category_id, updates.name);
        if (conflict) {
          throw new SkillError(
            "Skill name already exists under this category",
            "DUPLICATE_NAME"
          );
        }
      }
      skill.name = updates.name;
    }

    if (updates.description !== undefined) {
      skill.description = updates.description;
    }

    return { id: skill.id, name: skill.name, description: skill.description };
  }

  async deleteSkill(userId: string, skillId: string, force: boolean): Promise<void> {
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

  async getSkillById(
    userId: string,
    skillId: string
  ): Promise<{ id: string; name: string; current_xp: number; peak_xp: number } | null> {
    const skill = this.skills.get(skillId);
    if (!skill || skill.user_id !== userId) return null;
    return { id: skill.id, name: skill.name, current_xp: skill.current_xp, peak_xp: skill.peak_xp };
  }

  async applySessionXP(userId: string, skillId: string, xpEarned: number): Promise<SkillXPUpdate> {
    const skill = this.skills.get(skillId);
    if (!skill || skill.user_id !== userId) {
      throw new SkillError("Skill not found", "SKILL_NOT_FOUND");
    }
    skill.current_xp += xpEarned;
    skill.peak_xp = Math.max(skill.peak_xp, skill.current_xp);
    skill.last_session_at = new Date().toISOString();
    skill.has_history = true;
    return { new_current_xp: skill.current_xp, new_peak_xp: skill.peak_xp };
  }

  async seedHistory(skillId: string): Promise<void> {
    const skill = this.skills.get(skillId);
    if (!skill) {
      throw new SkillError("Skill not found", "SKILL_NOT_FOUND");
    }
    skill.has_history = true;
  }

  /**
   * Finds a skill owned by the given user in the given category with the given name.
   * Returns undefined when no match is found.
   * Used internally for duplicate-name checks on create and rename.
   */
  private findUserSkillByName(
    userId: string,
    categoryId: string,
    name: string
  ): Skill | undefined {
    for (const skill of this.skills.values()) {
      if (skill.user_id === userId && skill.category_id === categoryId && skill.name === name) {
        return skill;
      }
    }
    return undefined;
  }
}
