import { randomUUID, createHash } from "crypto";
import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface AuthUser {
  user_id: string;
  email: string;
}

export interface LoginResult {
  access_token: string;
  expires_at: number;
  user_id: string;
}

export interface IAuthService {
  signup(email: string, password: string): Promise<AuthUser>;
  login(email: string, password: string): Promise<LoginResult>;
  logout(token: string): Promise<void>;
  /**
   * Resolves the user_id associated with a live Bearer token.
   * Returns undefined if the token is invalid or unknown.
   */
  getUserId(token: string): string | undefined;
}

export class AuthError extends Error {
  constructor(
    message: string,
    public readonly code: string
  ) {
    super(message);
  }
}

export class InMemoryAuthService implements IAuthService {
  private users = new Map<string, { user_id: string; passwordHash: string }>();
  /** Maps access_token → user_id so profile routes can resolve the caller. */
  private tokenToUserId = new Map<string, string>();

  private hash(password: string): string {
    return createHash("sha256").update(password).digest("hex");
  }

  async signup(email: string, password: string): Promise<AuthUser> {
    const key = email.toLowerCase();
    if (this.users.has(key)) {
      throw new AuthError("Email already registered", "DUPLICATE_EMAIL");
    }
    const user_id = randomUUID();
    this.users.set(key, { user_id, passwordHash: this.hash(password) });
    return { user_id, email };
  }

  async login(email: string, password: string): Promise<LoginResult> {
    const user = this.users.get(email.toLowerCase());
    if (!user || user.passwordHash !== this.hash(password)) {
      throw new AuthError("Invalid email or password", "INVALID_CREDENTIALS");
    }
    const access_token = randomUUID();
    this.tokenToUserId.set(access_token, user.user_id);
    return {
      access_token,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      user_id: user.user_id,
    };
  }

  async logout(token: string): Promise<void> {
    if (!this.tokenToUserId.has(token)) {
      throw new AuthError("Unauthorized", "UNAUTHORIZED");
    }
    this.tokenToUserId.delete(token);
  }

  /**
   * Returns the user_id for a valid live token, or undefined if the token
   * is unknown / already logged out.
   */
  getUserId(token: string): string | undefined {
    return this.tokenToUserId.get(token);
  }
}

export class SupabaseAuthService implements IAuthService {
  private admin: SupabaseClient;

  constructor(url: string, serviceRoleKey: string) {
    this.admin = createClient(url, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }

  async signup(email: string, password: string): Promise<AuthUser> {
    const { data, error } = await this.admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (error) {
      if (error.message?.toLowerCase().includes("already registered") || error.status === 422) {
        throw new AuthError("Email already registered", "DUPLICATE_EMAIL");
      }
      throw new AuthError(error.message, "SUPABASE_ERROR");
    }
    return { user_id: data.user.id, email: data.user.email! };
  }

  async login(email: string, password: string): Promise<LoginResult> {
    const { data, error } = await this.admin.auth.signInWithPassword({ email, password });
    if (error) {
      throw new AuthError("Invalid email or password", "INVALID_CREDENTIALS");
    }
    return {
      access_token: data.session!.access_token,
      expires_at: data.session!.expires_at!,
      user_id: data.user!.id,
    };
  }

  async logout(token: string): Promise<void> {
    // Verify the token and get the user first
    const { data, error } = await this.admin.auth.getUser(token);
    if (error || !data.user) {
      throw new AuthError("Unauthorized", "UNAUTHORIZED");
    }
    // Use admin.signOut to revoke this specific access token (not just the local client session)
    const { error: signOutError } = await this.admin.auth.admin.signOut(token);
    if (signOutError) {
      throw new AuthError("Logout failed", "LOGOUT_ERROR");
    }
  }

  /**
   * JWT token→userId resolution for Supabase is done via getUser() which
   * makes a network call. Profile routes in production should call
   * admin.auth.getUser(token) directly. This stub satisfies the interface
   * contract for in-process testing; it is not used by profile routes in
   * production (they would use Supabase JWT verification instead).
   */
  getUserId(_token: string): string | undefined {
    // SupabaseAuthService.getUserId() is not implemented — Supabase JWT
    // verification requires an async admin.auth.getUser(token) call.
    // Profile routes must be migrated to async token resolution before
    // this service can be used in production.
    throw new Error("SupabaseAuthService.getUserId() is not implemented — use async admin.auth.getUser() instead");
  }
}
