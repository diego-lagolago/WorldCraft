export type ApiFetchResult<T> =
  | { ok: true; status: number; data: T }
  | { ok: false; error: string };

/** Fetch with a German error string. Network failures never become unhandled rejections. */
export async function apiFetch<T>(path: string, init?: RequestInit): Promise<ApiFetchResult<T>> {
  try {
    const response = await fetch(path, {
      ...init,
      headers: {
        ...(init?.body !== undefined ? { "content-type": "application/json" } : {}),
        ...init?.headers,
      },
    });
    const data = (await response.json().catch(() => ({}))) as { error?: string };
    if (!response.ok) {
      return { ok: false, error: data.error ?? "Das hat nicht geklappt." };
    }
    return { ok: true, status: response.status, data: data as T };
  } catch {
    return { ok: false, error: "Keine Verbindung zum Server." };
  }
}
