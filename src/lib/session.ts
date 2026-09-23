import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export async function requireProductSession() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return {
      session: null,
      response: NextResponse.json(
        { error: "Anmeldung erforderlich." },
        { status: 401 },
      ),
    };
  }
  return { session, response: null };
}
