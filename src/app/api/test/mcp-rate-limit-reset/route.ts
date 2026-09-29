import { NextResponse } from "next/server";
import { isTestLoginEnabled } from "@/lib/env";
import { resetMcpRateLimitForTests } from "@/lib/mcp/audit";

export const dynamic = "force-dynamic";

/** Test-only: clears the in-process MCP call windows so heavy suites can finish. */
export async function POST() {
  if (!isTestLoginEnabled()) {
    return new NextResponse(null, { status: 404 });
  }
  resetMcpRateLimitForTests();
  return NextResponse.json({ ok: true });
}
