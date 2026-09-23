import { NextResponse } from "next/server";
import type { AuthzFail } from "@/lib/authz";

export function failResponse(result: Pick<AuthzFail, "status" | "error">): NextResponse {
  return NextResponse.json({ error: result.error }, { status: result.status });
}

export function notFoundResponse(message = "Nicht gefunden."): NextResponse {
  return NextResponse.json({ error: message }, { status: 404 });
}
