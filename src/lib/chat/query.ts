import { fail, type AuthzFail } from "@/lib/authz";
import { parseUuid } from "@/lib/http";

/** Query-Parameter: missing is null, a non-UUID is 400 (CR-005). */
export function optionalUuid(value: string | null): { ok: true; id: string | null } | AuthzFail {
  if (value == null || value === "") return { ok: true, id: null };
  const id = parseUuid(value);
  if (!id) return fail(400, "Die Eingaben sind ungültig.");
  return { ok: true, id };
}
