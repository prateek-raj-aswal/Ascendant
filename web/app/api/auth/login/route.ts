import { NextRequest, NextResponse } from "next/server";
import { getAuthHandler, AuthError } from "@/lib/auth/handler";

export async function POST(req: NextRequest) {
  let body: { email?: unknown; password?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    // empty body
  }

  if (!body.email || !body.password) {
    return NextResponse.json({ error: "email and password are required" }, { status: 422 });
  }

  try {
    const handler = getAuthHandler();
    const result = await handler.login(body.email as string, body.password as string);

    // Omit access_token from the response body — it is set as an httpOnly cookie.
    // Returning it in the body would allow client JS to read it, negating httpOnly protection.
    const { access_token, ...safeResult } = result;
    const response = NextResponse.json(safeResult, { status: 200 });
    response.cookies.set("auth-token", access_token, {
      httpOnly: true,
      path: "/",
      maxAge: 3600,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
    return response;
  } catch (err) {
    if ((err as any)?.code === "INVALID_CREDENTIALS") {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
