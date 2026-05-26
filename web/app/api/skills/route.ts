import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAuthHandler } from "@/lib/auth/handler";
import { getSkillsHandler } from "@/lib/skills/handler";

async function resolveUserId(req: NextRequest): Promise<string | null> {
  void req;
  const cookieStore = await cookies();
  const token = cookieStore.get("auth-token")?.value;
  if (!token) return null;

  const authHandler = getAuthHandler();
  if (!authHandler.isValidToken(token)) return null;

  return authHandler.getUserIdForToken(token) ?? null;
}

// GET /api/skills — returns categories with user's skills
export async function GET(req: NextRequest) {
  const userId = await resolveUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const skillsHandler = getSkillsHandler();
  const categories = skillsHandler.getCategories(userId);
  return NextResponse.json({ categories }, { status: 200 });
}

// POST /api/skills — create a new skill
export async function POST(req: NextRequest) {
  const userId = await resolveUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { category_id?: unknown; name?: unknown; description?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    // empty body
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json(
      { error: "name is required", field: "name" },
      { status: 422 }
    );
  }

  const category_id = typeof body.category_id === "string" ? body.category_id : "";

  try {
    const skillsHandler = getSkillsHandler();
    const skill = skillsHandler.createSkill({
      user_id: userId,
      category_id,
      name,
      description: typeof body.description === "string" ? body.description : undefined,
    });

    return NextResponse.json(
      {
        id: skill.id,
        category_id: skill.category_id,
        name: skill.name,
        description: skill.description,
        current_xp: skill.current_xp,
        peak_xp: skill.peak_xp,
      },
      { status: 201 }
    );
  } catch (err) {
    if ((err as any)?.code === "CATEGORY_NOT_FOUND") {
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }
    if ((err as any)?.code === "SKILL_NAME_EXISTS") {
      return NextResponse.json(
        { error: "Skill name already exists under this category" },
        { status: 409 }
      );
    }
    if ((err as any)?.code === "NAME_REQUIRED") {
      return NextResponse.json(
        { error: "name is required", field: "name" },
        { status: 422 }
      );
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
