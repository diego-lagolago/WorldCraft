import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getAuthUrl, isTestLoginEnabled } from "@/lib/env";

export const dynamic = "force-dynamic";

function notFound(): NextResponse {
  return new NextResponse(null, { status: 404 });
}

export async function POST(request: Request) {
  if (!isTestLoginEnabled()) {
    return notFound();
  }

  const body = await request.text();
  const headers = new Headers(request.headers);
  headers.delete("content-length");
  if (!headers.get("origin") && !headers.get("referer")) {
    headers.set("origin", getAuthUrl());
  }

  return auth.handler(
    new Request(new URL("/api/auth/test-login", request.url), {
      method: "POST",
      headers,
      body,
    }),
  );
}

export function GET() {
  return notFoundUnlessEnabled();
}

export function PUT() {
  return notFoundUnlessEnabled();
}

export function DELETE() {
  return notFoundUnlessEnabled();
}

function notFoundUnlessEnabled(): NextResponse {
  if (!isTestLoginEnabled()) {
    return notFound();
  }
  return new NextResponse(null, { status: 405, headers: { Allow: "POST" } });
}
