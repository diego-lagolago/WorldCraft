import { eq, ne, or, type AnyColumn, type SQL } from "drizzle-orm";
import { isStaff, type MembershipRole } from "@/lib/authz";

/**
 * SQL counterpart of APP-VIS-OWNER for three-tier content tables.
 * Server-only — do not import from client components (keeps Drizzle out of bundles).
 */
export function visibleContentWhere(
  columns: { visibility: AnyColumn; ownerId: AnyColumn },
  viewer: { role: MembershipRole; userId: string },
): SQL {
  if (!isStaff(viewer.role)) {
    return eq(columns.visibility, "published");
  }
  return or(ne(columns.visibility, "owner_only"), eq(columns.ownerId, viewer.userId))!;
}
