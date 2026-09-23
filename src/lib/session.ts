import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export async function getOptionalSession() {
  return auth.api.getSession({ headers: await headers() });
}

export async function requireProductSession() {
  const session = await getOptionalSession();
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
