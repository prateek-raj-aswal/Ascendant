// ---------------------------------------------------------------------------
// Contract types — derived from S-002 contracts.json
// ---------------------------------------------------------------------------

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
  subscription_tier: string;
  ai_calls_this_month: number;
  ai_quota_limit: number;
}

export interface OnboardInput {
  user_id: string;
  display_name: string;
  avatar_seed: string;
}

export interface OnboardResult {
  id: string;
  display_name: string;
  avatar_seed: string;
  class: string;
  total_xp: number;
}

// ---------------------------------------------------------------------------
// Error
// ---------------------------------------------------------------------------

export class ProfileError extends Error {
  constructor(
    message: string,
    public readonly code: string
  ) {
    super(message);
    this.name = "ProfileError";
  }
}

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface IProfileService {
  onboard(input: OnboardInput): Promise<OnboardResult>;
  getProfile(user_id: string): Promise<UserProfile>;
}

// ---------------------------------------------------------------------------
// In-memory implementation (dev/test)
// ---------------------------------------------------------------------------

const DEFAULT_PROFILE = {
  class: "shadow_novice",
  total_xp: 0,
  burnout_active: false,
  burnout_started_at: null,
  current_streak: 0,
  longest_streak: 0,
  subscription_tier: "free",
  ai_calls_this_month: 0,
  ai_quota_limit: 10,
} as const;

export class InMemoryProfileService implements IProfileService {
  private profiles = new Map<string, UserProfile>();

  async onboard(input: OnboardInput): Promise<OnboardResult> {
    const { user_id, display_name, avatar_seed } = input;

    if (!display_name || display_name.trim().length === 0) {
      throw new ProfileError("display_name is required", "DISPLAY_NAME_REQUIRED");
    }

    if (this.profiles.has(user_id)) {
      throw new ProfileError("Profile already exists for this user", "PROFILE_EXISTS");
    }

    const profile: UserProfile = {
      id: user_id,
      display_name: display_name.trim(),
      avatar_seed,
      ...DEFAULT_PROFILE,
    };

    this.profiles.set(user_id, profile);

    return {
      id: profile.id,
      display_name: profile.display_name,
      avatar_seed: profile.avatar_seed,
      class: profile.class,
      total_xp: profile.total_xp,
    };
  }

  addTotalXP(user_id: string, xpEarned: number): number {
    const profile = this.profiles.get(user_id);
    if (!profile) return 0;
    profile.total_xp += xpEarned;
    this.profiles.set(user_id, profile);
    return profile.total_xp;
  }

  async getProfile(user_id: string): Promise<UserProfile> {
    const profile = this.profiles.get(user_id);
    if (!profile) {
      throw new ProfileError("Profile not found", "PROFILE_NOT_FOUND");
    }
    return profile;
  }
}
