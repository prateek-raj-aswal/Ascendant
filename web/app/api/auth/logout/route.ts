import { NextRequest, NextResponse } from "next/server";
import { getAuthHandler } from "@/lib/auth/handler";

export async function POST(req: NextRequest) {
  const token = req.cookies.get("auth-token")?.value;
  if (token) {
    const handler = getAuthHandler();
    try {
      await handler.logout(token);
    } catch {
      // Token may be invalid/expired — clear cookie regardless
    }
  }

  const response = new NextResponse(null, { status: 204 });
  response.cookies.delete("auth-token");
  return response;
}
