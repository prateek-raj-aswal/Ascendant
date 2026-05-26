/**
 * Full shape of a user profile as returned by GET /api/profile.
 * All fields reflect contract S-002 and the user_profiles DB schema.
 */
export interface UserProfile {
  id: string;
  display_name: string;
  avatar_seed: string;
  class: string;
  total_xp: number;
  burnout_active: boolean;
  burnout_started_at: string | null;
  current_streak: number;
  longest_streak: number;
  last_session_date: string | null;
  subscription_tier: string;
  ai_calls_this_month: number;
  ai_quota_limit: number;
  ai_quota_reset_at: string | null;
}

/** Subset returned by POST /api/profile/onboard (creation response). */
export type OnboardResult = Pick<
  UserProfile,
  "id" | "display_name" | "avatar_seed" | "class" | "total_xp"
>;

export interface IProfileService {
  /**
   * Adds XP to the user's total_xp. Silently no-ops if no profile exists
   * (in-memory dev: users may not have a profile during tests).
   * @returns new total_xp, or 0 if no profile found
   */
  addTotalXP(userId: string, xpEarned: number): Promise<number>;
  /**
   * Creates a new profile for the given user.
   * Throws ProfileError("PROFILE_EXISTS") if the user already has one.
   *
   * @param userId - Authenticated user's id (from auth token)
   * @param displayName - Chosen display name (1–100 chars)
   * @param avatarSeed - Seed string used to deterministically generate an avatar
   * @returns The newly created profile fields required by the onboard response
   */
  onboard(userId: string, displayName: string, avatarSeed: string): Promise<OnboardResult>;

  /**
   * Retrieves the profile for the given user.
   * Throws ProfileError("PROFILE_NOT_FOUND") if none exists yet.
   *
   * @param userId - Authenticated user's id (from auth token)
   * @returns The full profile object
   */
  getProfile(userId: string): Promise<UserProfile>;
}

/** Typed error for profile-domain failures, mirroring the AuthError pattern. */
export class ProfileError extends Error {
  constructor(
    message: string,
    public readonly code: string
  ) {
    super(message);
    this.name = "ProfileError";
  }
}

/** Free-tier AI call quota, as specified in S-002 defaults. */
const FREE_TIER_AI_QUOTA_LIMIT = 10;

export class InMemoryProfileService implements IProfileService {
  /** Keyed by userId — one profile per user enforced here. */
  private profiles = new Map<string, UserProfile>();

  async onboard(userId: string, displayName: string, avatarSeed: string): Promise<OnboardResult> {
    if (this.profiles.has(userId)) {
      throw new ProfileError("Profile already exists for this user", "PROFILE_EXISTS");
    }

    const profile: UserProfile = {
      id: userId,
      display_name: displayName,
      avatar_seed: avatarSeed,
      class: "shadow_novice",
      total_xp: 0,
      burnout_active: false,
      burnout_started_at: null,
      current_streak: 0,
      longest_streak: 0,
      last_session_date: null,
      subscription_tier: "free",
      ai_calls_this_month: 0,
      ai_quota_limit: FREE_TIER_AI_QUOTA_LIMIT,
      ai_quota_reset_at: null,
    };

    this.profiles.set(userId, profile);

    return {
      id: profile.id,
      display_name: profile.display_name,
      avatar_seed: profile.avatar_seed,
      class: profile.class,
      total_xp: profile.total_xp,
    };
  }

  async addTotalXP(userId: string, xpEarned: number): Promise<number> {
    const profile = this.profiles.get(userId);
    if (!profile) return 0;
    profile.total_xp += xpEarned;
    return profile.total_xp;
  }

  async getProfile(userId: string): Promise<UserProfile> {
    const profile = this.profiles.get(userId);
    if (!profile) {
      throw new ProfileError("Profile not found", "PROFILE_NOT_FOUND");
    }
    return profile;
  }
}
