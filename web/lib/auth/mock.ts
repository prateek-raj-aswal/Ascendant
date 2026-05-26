import { randomUUID, createHash } from "crypto";

export interface AuthUser {
  user_id: string;
  email: string;
}

export interface LoginResult {
  access_token: string;
  expires_at: number;
  user_id: string;
}

export class AuthError extends Error {
  constructor(
    message: string,
    public readonly code: string
  ) {
    super(message);
  }
}

export class InMemoryAuthHandler {
  private users = new Map<string, { user_id: string; passwordHash: string }>();
  private tokens = new Set<string>();
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
    this.tokens.add(access_token);
    this.tokenToUserId.set(access_token, user.user_id);
    return {
      access_token,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      user_id: user.user_id,
    };
  }

  async logout(token: string): Promise<void> {
    if (!this.tokens.has(token)) {
      throw new AuthError("Unauthorized", "UNAUTHORIZED");
    }
    this.tokens.delete(token);
    this.tokenToUserId.delete(token);
  }

  isValidToken(token: string): boolean {
    return this.tokens.has(token);
  }

  getUserIdForToken(token: string): string | undefined {
    return this.tokenToUserId.get(token);
  }
}
