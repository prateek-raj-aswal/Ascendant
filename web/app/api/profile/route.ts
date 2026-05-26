import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAuthHandler } from "@/lib/auth/handler";
import { getProfileHandler } from "@/lib/profile/handler";

export async function GET(_req: NextRequest) {
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

  const user_id = authHandler.getUserIdForToken(token);
  if (!user_id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const profileHandler = getProfileHandler();
    const profile = await profileHandler.getProfile(user_id);
    return NextResponse.json(profile, { status: 200 });
  } catch (err) {
    if ((err as any)?.code === "PROFILE_NOT_FOUND") {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
