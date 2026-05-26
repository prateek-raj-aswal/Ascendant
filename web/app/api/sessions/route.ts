import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAuthHandler } from "@/lib/auth/handler";
import { getSessionsHandler } from "@/lib/sessions/handler";
import { SessionError } from "@/lib/sessions/service";

async function resolveUserId(): Promise<string | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth-token")?.value;
  if (!token) return null;

  const authHandler = getAuthHandler();
  if (!authHandler.isValidToken(token)) return null;

  return authHandler.getUserIdForToken(token) ?? null;
}

// POST /api/sessions — log a training session
export async function POST(req: NextRequest) {
  const userId = await resolveUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    skill_id?: unknown;
    duration_minutes?: unknown;
    difficulty_multiplier?: unknown;
    notes?: unknown;
  } = {};
  try {
    body = await req.json();
  } catch {
    // empty body
  }

  try {
    const handler = getSessionsHandler();
    const result = handler.logSession({
      user_id: userId,
      skill_id: typeof body.skill_id === "string" ? body.skill_id : "",
      duration_minutes: typeof body.duration_minutes === "number" ? body.duration_minutes : 0,
      difficulty_multiplier:
        typeof body.difficulty_multiplier === "number" ? body.difficulty_multiplier : 0,
      notes: typeof body.notes === "string" ? body.notes : undefined,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    if (err instanceof SessionError) {
      if (err.code === "INVALID_DURATION") {
        return NextResponse.json({ error: "INVALID_DURATION" }, { status: 400 });
      }
      if (err.code === "INVALID_DIFFICULTY") {
        return NextResponse.json({ error: "INVALID_DIFFICULTY" }, { status: 400 });
      }
      if (err.code === "SKILL_NOT_FOUND") {
        return NextResponse.json({ error: "SKILL_NOT_FOUND" }, { status: 404 });
      }
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// GET /api/sessions — list sessions, optionally filtered by skill_id
export async function GET(req: NextRequest) {
  const userId = await resolveUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const skillId = req.nextUrl.searchParams.get("skill_id") ?? undefined;
  const limit = Math.min(parseInt(req.nextUrl.searchParams.get("limit") ?? "20", 10) || 20, 100);
  const offset = parseInt(req.nextUrl.searchParams.get("offset") ?? "0", 10) || 0;

  const handler = getSessionsHandler();
  const result = handler.getSessions(userId, skillId, limit, offset);

  return NextResponse.json(result, { status: 200 });
}
