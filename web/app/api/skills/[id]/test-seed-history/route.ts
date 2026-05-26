import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAuthHandler } from "@/lib/auth/handler";
import { getSkillsHandler } from "@/lib/skills/handler";

// POST /api/skills/[id]/test-seed-history
// Test-only route — marks a skill as having session history.
// Only active outside of production.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  void req;

  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const cookieStore = await cookies();
  const token = cookieStore.get("auth-token")?.value;
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const authHandler = getAuthHandler();
  if (!authHandler.isValidToken(token)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const skillsHandler = getSkillsHandler();
    skillsHandler.seedHistory(id);
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    if ((err as any)?.code === "SKILL_NOT_FOUND") {
      return NextResponse.json({ error: "Skill not found" }, { status: 404 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
