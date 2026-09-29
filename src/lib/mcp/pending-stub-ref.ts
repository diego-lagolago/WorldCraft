/** Template ref waiting for a stub article that is only created after confirmation. */
export type PendingStubRef = { __stubTitle: string };

export function isPendingStubRef(value: unknown): value is PendingStubRef {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value) && "__stubTitle" in (value as object);
}
