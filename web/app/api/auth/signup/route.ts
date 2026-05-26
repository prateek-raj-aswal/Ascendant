import { NextRequest, NextResponse } from "next/server";
import { getAuthHandler, AuthError } from "@/lib/auth/handler";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  let body: { email?: unknown; password?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    // empty body — validation below will catch it
  }

  if (!body.email || typeof body.email !== "string" || !EMAIL_RE.test(body.email)) {
    return NextResponse.json({ error: "Invalid email format", field: "email" }, { status: 422 });
  }
  if (!body.password || typeof body.password !== "string" || body.password.length < 8) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters", field: "password" },
      { status: 422 }
    );
  }

  try {
    const handler = getAuthHandler();
    const user = await handler.signup(body.email, body.password);
    return NextResponse.json(user, { status: 201 });
  } catch (err) {
    if ((err as any)?.code === "DUPLICATE_EMAIL") {
      return NextResponse.json({ error: "Email already registered" }, { status: 409 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
