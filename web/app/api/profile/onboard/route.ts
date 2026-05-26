import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAuthHandler } from "@/lib/auth/handler";
import { getProfileHandler } from "@/lib/profile/handler";

export async function POST(req: NextRequest) {
  // Validate auth token from httpOnly cookie
  const cookieStore = await cookies();
  const token = cookieStore.get("auth-token")?.value;

  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const authHandler = getAuthHandler();
  if (!authHandler.isValidToken(token)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Parse request body
  let body: { display_name?: unknown; avatar_seed?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    // empty body
  }

  const displayName = typeof body.display_name === "string" ? body.display_name.trim() : "";
  if (!displayName) {
    return NextResponse.json(
      { error: "display_name is required", field: "display_name" },
      { status: 422 }
    );
  }
  if (displayName.length > 100) {
    return NextResponse.json(
      { error: "display_name must be 100 characters or fewer", field: "display_name" },
      { status: 422 }
    );
  }

  // Resolve user_id from token — we need to look up the token owner.
  // The InMemoryAuthHandler does not expose a getUser(token) method yet,
  // so we use a workaround: the handler tracks tokens; we need the user_id.
  // We extend the auth handler lookup via the exported helper below.
  const user_id = authHandler.getUserIdForToken(token);
  if (!user_id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const profileHandler = getProfileHandler();
    const result = await profileHandler.onboard({
      user_id,
      display_name: displayName,
      avatar_seed: typeof body.avatar_seed === "string" ? body.avatar_seed : "",
    });

    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    if ((err as any)?.code === "PROFILE_EXISTS") {
      return NextResponse.json(
        { error: "Profile already exists for this user" },
        { status: 409 }
      );
    }
    if ((err as any)?.code === "DISPLAY_NAME_REQUIRED") {
      return NextResponse.json(
        { error: "display_name is required", field: "display_name" },
        { status: 422 }
      );
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
