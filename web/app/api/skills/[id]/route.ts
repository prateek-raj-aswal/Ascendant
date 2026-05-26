import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAuthHandler } from "@/lib/auth/handler";
import { getSkillsHandler } from "@/lib/skills/handler";

async function resolveUserId(): Promise<string | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth-token")?.value;
  if (!token) return null;

  const authHandler = getAuthHandler();
  if (!authHandler.isValidToken(token)) return null;

  return authHandler.getUserIdForToken(token) ?? null;
}

// PUT /api/skills/[id] — rename/update a skill
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await resolveUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  let body: { name?: unknown; description?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    // empty body
  }

  const input: { name?: string; description?: string } = {};
  if (typeof body.name === "string") input.name = body.name;
  if (typeof body.description === "string") input.description = body.description;

  try {
    const skillsHandler = getSkillsHandler();
    const skill = skillsHandler.updateSkill(id, userId, input);
    return NextResponse.json(
      { id: skill.id, name: skill.name, description: skill.description },
      { status: 200 }
    );
  } catch (err) {
    if ((err as any)?.code === "SKILL_NOT_FOUND") {
      return NextResponse.json({ error: "Skill not found" }, { status: 404 });
    }
    if ((err as any)?.code === "SKILL_NAME_EXISTS") {
      return NextResponse.json(
        { error: "Skill name already exists under this category" },
        { status: 409 }
      );
    }
    if ((err as any)?.code === "NO_FIELDS") {
      return NextResponse.json(
        { error: "No updatable fields provided" },
        { status: 422 }
      );
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/skills/[id] — delete a skill
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await resolveUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const force = req.nextUrl.searchParams.get("force") === "true";

  try {
    const skillsHandler = getSkillsHandler();
    skillsHandler.deleteSkill(id, userId, force);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    if ((err as any)?.code === "SKILL_NOT_FOUND") {
      return NextResponse.json({ error: "Skill not found" }, { status: 404 });
    }
    if ((err as any)?.code === "HAS_HISTORY") {
      return NextResponse.json(
        { error: "Skill has session history. Pass force=true to confirm deletion." },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
