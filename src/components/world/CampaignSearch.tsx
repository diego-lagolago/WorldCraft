"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/client/api";
import { SEARCH_QUERY_MIN, type SearchHit } from "@/lib/search";

const DEBOUNCE_MS = 300;

export function CampaignSearch({ worldId }: { worldId: string }) {
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < SEARCH_QUERY_MIN) {
      setHits(null);
      setError(null);
      setPending(false);
      return;
    }

    setPending(true);
    const timer = window.setTimeout(() => {
      void (async () => {
        const result = await apiRequest<{ hits: SearchHit[] }>(
          `/api/worlds/${worldId}/search?q=${encodeURIComponent(trimmed)}`,
          "GET",
        );
        setPending(false);
        if (!result.ok) {
          setError(result.error);
          setHits(null);
          return;
        }
        setError(null);
        setHits(result.data.hits);
      })();
    }, DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [query, worldId]);

  const trimmed = query.trim();
  const showResults = trimmed.length >= SEARCH_QUERY_MIN;

  return (
    <div className="stack" style={{ gap: 8, margin: "12px 0" }}>
      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="In dieser Welt suchen …"
        aria-label="In dieser Welt suchen"
        autoComplete="off"
      />
      {showResults ? (
        <div className="card list" style={{ padding: "0 4px" }} aria-live="polite">
          {pending && hits === null ? <div className="empty">Suche …</div> : null}
          {error ? (
            <div className="empty error-text" role="alert">
              {error}
            </div>
          ) : null}
          {!pending && !error && hits && hits.length === 0 ? (
            <div className="empty">Keine Treffer für „{trimmed}“.</div>
          ) : null}
          {hits?.map((hit) => (
            <Link key={`${hit.kind}:${hit.id}`} className="item" href={hit.href}>
              <div className="grow">
                <div>
                  {hit.title} <span className="kind">· {hit.kindLabel}</span>
                </div>
                {hit.snippet ? <div className="small muted">{hit.snippet}</div> : null}
              </div>
            </Link>
          ))}
          {hits && hits.length > 0 ? (
            <div className="small muted" style={{ padding: "8px 12px" }}>
              Tagebücher werden nicht durchsucht.
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
