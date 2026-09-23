"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/client/api";
import { SEARCH_QUERY_MIN, type SearchHit } from "@/lib/search";

const DEBOUNCE_MS = 300;

export function CampaignSearch({ worldId }: { worldId: string }) {
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const trimmed = query.trim();
  const active = trimmed.length >= SEARCH_QUERY_MIN;

  useEffect(() => {
    if (!active) return;

    let cancelled = false;
    const timer = window.setTimeout(() => {
      setPending(true);
      void (async () => {
        const result = await apiRequest<{ hits: SearchHit[] }>(
          `/api/worlds/${worldId}/search?q=${encodeURIComponent(trimmed)}`,
          "GET",
        );
        if (cancelled) return;
        setPending(false);
        if (!result.ok) {
          setError(result.error);
          setHits([]);
          return;
        }
        setError(null);
        setHits(result.data.hits);
      })();
    }, DEBOUNCE_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [active, trimmed, worldId]);

  return (
    <div className="stack" style={{ gap: 8, margin: "12px 0" }}>
      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="In dieser Welt suchen …"
        aria-label="In dieser Welt suchen"
        autoComplete="off"
      />
      {active ? (
        <div className="card list" style={{ padding: "0 4px" }} aria-live="polite">
          {pending && hits.length === 0 && !error ? <div className="empty">Suche …</div> : null}
          {error ? (
            <div className="empty error-text" role="alert">
              {error}
            </div>
          ) : null}
          {!pending && !error && hits.length === 0 ? (
            <div className="empty">Keine Treffer für „{trimmed}“.</div>
          ) : null}
          {hits.map((hit) => (
            <Link key={`${hit.kind}:${hit.id}`} className="item" href={hit.href}>
              <div className="grow">
                <div>
                  {hit.title} <span className="kind">· {hit.kindLabel}</span>
                </div>
                {hit.snippet ? <div className="small muted">{hit.snippet}</div> : null}
              </div>
            </Link>
          ))}
          {hits.length > 0 ? (
            <div className="small muted" style={{ padding: "8px 12px" }}>
              Tagebücher werden nicht durchsucht.
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
