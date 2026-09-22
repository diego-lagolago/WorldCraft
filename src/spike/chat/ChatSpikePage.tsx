"use client";

/** Spike T-010 — Gruppenchat, Handy zuerst: + / Würfel / Eingabe / Papierflugzeug. */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import "./chat.css";
import {
  ALLOWED_SIDES,
  MAX_DICE_TERMS,
  formatCompactFromDto,
  formatStructuredPreview,
  type StructuredDiceTerm,
} from "./dice-sides";
import type {
  SpikeChatMessageDto,
  SpikeChatRealtimeEvent,
  SpikeChatState,
  SpikeChatThreadDto,
} from "./types";

type Props = {
  currentUserId: string;
  currentUserName: string;
  initialState: SpikeChatState;
};

type DiceDraft = {
  terms: StructuredDiceTerm[];
  modifier: number;
};

type Sheet = "none" | "actions" | "thread" | "dice";

const DEFAULT_DRAFT: DiceDraft = { terms: [{ n: 1, m: 20 }], modifier: 0 };

function formatTime(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
}

function compactDiceLine(message: SpikeChatMessageDto): string {
  if (!message.dice) return message.body;
  if (message.body.includes("→")) return message.body;
  return formatCompactFromDto(message.dice);
}

function clampCount(value: number): number {
  return Math.min(20, Math.max(1, value));
}

function clampModifier(value: number): number {
  return Math.min(99, Math.max(-99, value));
}

function sameStream(message: SpikeChatMessageDto, state: SpikeChatState): boolean {
  return (
    message.channelId === state.channel.id &&
    (message.threadId ?? null) === (state.thread?.id ?? null)
  );
}

function DiceIcon() {
  return (
    <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden>
      <rect
        x="3.5"
        y="3.5"
        width="17"
        height="17"
        rx="3.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <circle cx="8.2" cy="8.2" r="1.35" fill="currentColor" />
      <circle cx="15.8" cy="8.2" r="1.35" fill="currentColor" />
      <circle cx="12" cy="12" r="1.35" fill="currentColor" />
      <circle cx="8.2" cy="15.8" r="1.35" fill="currentColor" />
      <circle cx="15.8" cy="15.8" r="1.35" fill="currentColor" />
    </svg>
  );
}

function PlaneIcon() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden>
      <path
        d="M21.5 3.5 3.8 10.4l6.8 2.5 2.4 6.9 8.5-16.3Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M10.6 12.9 21.5 3.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function ChatSpikePage({
  currentUserId,
  currentUserName,
  initialState,
}: Props) {
  const router = useRouter();
  const [state, setState] = useState(initialState);
  const [draft, setDraft] = useState("");
  const [threadTitle, setThreadTitle] = useState("Neuer Thread");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sheet, setSheet] = useState<Sheet>("none");
  const [diceDraft, setDiceDraft] = useState<DiceDraft>(DEFAULT_DRAFT);
  const [dicePostToChat, setDicePostToChat] = useState(initialState.dicePostToChat);
  const [privateRoll, setPrivateRoll] = useState<string | null>(null);
  const [copiedHint, setCopiedHint] = useState(false);
  const logRef = useRef<HTMLDivElement | null>(null);
  const stateRef = useRef(state);
  const idsRef = useRef(new Set(initialState.messages.map((message) => message.id)));
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const showStream = useCallback((next: SpikeChatState) => {
    idsRef.current = new Set(next.messages.map((message) => message.id));
    setState(next);
    const params = new URLSearchParams();
    params.set("channel", next.channel.id);
    if (next.thread) params.set("thread", next.thread.id);
    router.replace(`/spike/chat?${params.toString()}`);
  }, [router]);

  const append = useCallback((message: SpikeChatMessageDto) => {
    if (idsRef.current.has(message.id)) return;
    if (!sameStream(message, stateRef.current)) return;
    idsRef.current.add(message.id);
    setState((current) => ({
      ...current,
      messages: [...current.messages, message].slice(-50),
    }));
  }, []);

  useEffect(() => {
    const source = new EventSource("/api/spike/chat/events");
    source.onmessage = (event) => {
      const payload = JSON.parse(event.data) as SpikeChatRealtimeEvent;
      if (payload.type === "message") {
        append(payload.message);
        return;
      }
      if (payload.type === "thread.created") {
        setState((current) => {
          if (payload.thread.channelId !== current.channel.id) return current;
          if (current.threads.some((thread) => thread.id === payload.thread.id)) return current;
          return { ...current, threads: [payload.thread, ...current.threads] };
        });
      }
    };
    source.onerror = () => {
      /* Browser reconnects EventSource automatically. */
    };
    return () => source.close();
  }, [append]);

  useEffect(() => {
    const log = logRef.current;
    if (log) log.scrollTop = log.scrollHeight;
  }, [state.messages]);

  async function loadStream(channelId: string, threadId?: string | null) {
    const query = new URLSearchParams({ channelId });
    if (threadId) query.set("threadId", threadId);
    const response = await fetch(`/api/spike/chat?${query}`, { credentials: "include" });
    if (!response.ok) throw new Error("Chat konnte nicht geladen werden.");
    showStream((await response.json()) as SpikeChatState);
  }

  async function postJson(body: unknown) {
    const response = await fetch("/api/spike/chat", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = (await response.json()) as {
      message?: SpikeChatMessageDto;
      posted?: boolean;
      dice?: { compact?: string };
      error?: string;
    };
    if (!response.ok) {
      throw new Error(payload.error ?? "Nachricht konnte nicht gesendet werden.");
    }
    if (payload.message) append(payload.message);
    return payload;
  }

  function scopePayload() {
    return {
      channelId: state.channel.id,
      threadId: state.thread?.id ?? null,
    };
  }

  async function sendText() {
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    setError(null);
    try {
      await postJson({ body, ...scopePayload() });
      setDraft("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Nachricht konnte nicht gesendet werden.");
    } finally {
      setSending(false);
    }
  }

  async function persistPostSwitch(next: boolean) {
    setDicePostToChat(next);
    try {
      const response = await fetch("/api/spike/chat/settings", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dicePostToChat: next }),
      });
      if (!response.ok) throw new Error();
    } catch {
      setDicePostToChat(!next);
      setError("Einstellung konnte nicht gespeichert werden.");
    }
  }

  async function copyPrivateRoll() {
    if (!privateRoll) return;
    const match = /=\s*(-?\d+)\s*$/.exec(privateRoll);
    if (!match) return;
    try {
      await navigator.clipboard.writeText(match[1]);
      setCopiedHint(true);
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
      copiedTimerRef.current = setTimeout(() => setCopiedHint(false), 1200);
    } catch {
      /* versteckte Funktion: still fail */
    }
  }

  useEffect(() => {
    return () => {
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
    };
  }, []);

  async function sendRoll() {
    if (sending) return;
    setSending(true);
    setError(null);
    try {
      const payload = await postJson({
        kind: "roll",
        terms: diceDraft.terms,
        ...(diceDraft.modifier !== 0 ? { modifier: diceDraft.modifier } : {}),
        ...scopePayload(),
      });
      if (payload.posted === false) {
        setPrivateRoll(payload.dice?.compact ?? formatStructuredPreview(diceDraft));
        return;
      }
      setSheet("none");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Wurf konnte nicht ausgeführt werden.");

    } finally {
      setSending(false);
    }
  }

  async function startThread() {
    const title = threadTitle.trim() || "Neuer Thread";
    if (sending) return;
    setSending(true);
    setError(null);
    try {
      const response = await fetch("/api/spike/chat/threads", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channelId: state.channel.id, title }),
      });
      const payload = (await response.json()) as {
        thread?: SpikeChatThreadDto;
        message?: SpikeChatMessageDto;
        error?: string;
      };
      if (!response.ok || !payload.thread) {
        throw new Error(payload.error ?? "Thread konnte nicht gestartet werden.");
      }
      if (payload.message) append(payload.message);
      setSheet("none");
      await loadStream(state.channel.id, payload.thread.id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Thread konnte nicht gestartet werden.");
    } finally {
      setSending(false);
    }
  }

  function updateTerm(index: number, patch: Partial<StructuredDiceTerm>) {
    setDiceDraft((current) => ({
      ...current,
      terms: current.terms.map((term, i) => (i === index ? { ...term, ...patch } : term)),
    }));
  }

  const heading = state.thread ? state.thread.title : `# ${state.channel.name}`;
  const sub = state.thread ? `# ${state.channel.name} · ${currentUserName}` : currentUserName;

  return (
    <main className="spike-chat">
      <header className="spike-chat-header">
        {state.thread ? (
          <button
            type="button"
            className="spike-chat-back"
            aria-label="Zurück"
            onClick={() => void loadStream(state.channel.id, null)}
          >
            ←
          </button>
        ) : (
          <Link href="/" aria-label="Zurück">
            ←
          </Link>
        )}
        <div className="spike-chat-title">
          <h1>{heading}</h1>
          <p>{sub}</p>
        </div>
      </header>
      <div className="spike-chat-log" ref={logRef}>
        {state.messages.length === 0 ? (
          <p className="spike-chat-empty">
            Noch keine Nachrichten. Schreib etwas oder tippe auf den Würfel.
          </p>
        ) : (
          state.messages.map((message) => {
            const opensThread = Boolean(message.opensThreadId);
            return (
              <article
                key={message.id}
                className={`spike-chat-bubble${message.authorId === currentUserId ? " own" : ""}${opensThread ? " thread" : ""}`}
              >
                <div className="spike-chat-author">{message.authorName}</div>
                {opensThread && message.opensThreadId ? (
                  <button
                    type="button"
                    className="spike-chat-thread-open"
                    onClick={() => void loadStream(state.channel.id, message.opensThreadId)}
                  >
                    <span className="spike-chat-thread-label">Thread</span>
                    <span className="spike-chat-body">{message.body}</span>
                  </button>
                ) : (
                  <div className={message.dice ? "spike-chat-dice" : "spike-chat-body"}>
                    {message.dice ? compactDiceLine(message) : message.body}
                  </div>
                )}
                <div className="spike-chat-time">{formatTime(message.sentAt)}</div>
              </article>
            );
          })
        )}
      </div>
      {error ? <p className="spike-chat-error">{error}</p> : null}
      <form
        className="spike-chat-composer"
        onSubmit={(event) => {
          event.preventDefault();
          void sendText();
        }}
      >
        <button
          className="spike-chat-icon-btn"
          type="button"
          aria-label="Aktionen"
          disabled={sending}
          onClick={() => {
            setError(null);
            setSheet("actions");
          }}
        >
          +
        </button>
        <button
          className="spike-chat-icon-btn"
          type="button"
          aria-label="Würfeln"
          disabled={sending}
          onClick={() => {
            setError(null);
            setDiceDraft(DEFAULT_DRAFT);
            setPrivateRoll(null);
            setSheet("dice");
          }}
        >
          <DiceIcon />
        </button>
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Nachricht"
          maxLength={2000}
          enterKeyHint="send"
          autoComplete="off"
          disabled={sending}
          aria-label="Nachricht"
        />
        <button
          className="spike-chat-send"
          type="submit"
          aria-label="Senden"
          disabled={sending || !draft.trim()}
        >
          <PlaneIcon />
        </button>
      </form>
      {sheet !== "none" ? (
        <div className="spike-chat-sheet-root">
          <button
            type="button"
            className="spike-chat-backdrop"
            aria-label="Schließen"
            onClick={() => setSheet("none")}
          />
          {sheet === "actions" ? (
            <section className="spike-chat-action-sheet" aria-label="Aktionen">
              <button
                type="button"
                onClick={() => {
                  setThreadTitle("Neuer Thread");
                  setSheet("thread");
                }}
              >
                Thread starten
              </button>
            </section>
          ) : null}
          {sheet === "thread" ? (
            <section className="spike-chat-sheet" aria-label="Thread starten">
              <div className="spike-chat-sheet-handle" />
              <h2>Thread starten</h2>
              <label className="spike-chat-term">
                Titel
                <input
                  value={threadTitle}
                  onChange={(event) => setThreadTitle(event.target.value)}
                  maxLength={80}
                />
              </label>
              <div className="spike-chat-sheet-actions">
                <button type="button" className="spike-chat-secondary" onClick={() => setSheet("none")}>
                  Abbrechen
                </button>
                <button
                  type="button"
                  className="spike-chat-roll"
                  disabled={sending || !threadTitle.trim()}
                  onClick={() => void startThread()}
                >
                  Thread öffnen
                </button>
              </div>
            </section>
          ) : null}
          {sheet === "dice" ? (
            <section className="spike-chat-sheet" aria-label="Würfeln">
              <div className="spike-chat-sheet-handle" />
              <h2>Würfeln</h2>
              <div className="spike-chat-dice-layout">
                <div className="spike-chat-dice-controls">
                  {diceDraft.terms.map((term, index) => (
                    <div className="spike-chat-term" key={`term-${index}`}>
                      <div className="spike-chat-term-head">
                        <span>{index === 0 ? "Würfel" : `Plus-Würfel ${index + 1}`}</span>
                        {index > 0 ? (
                          <button
                            type="button"
                            className="spike-chat-text-btn"
                            onClick={() =>
                              setDiceDraft((current) => ({
                                ...current,
                                terms: current.terms.filter((_, i) => i !== index),
                              }))
                            }
                          >
                            Entfernen
                          </button>
                        ) : null}
                      </div>
                      <div className="spike-chat-stepper">
                        <button
                          type="button"
                          aria-label="Weniger Würfel"
                          onClick={() => updateTerm(index, { n: clampCount(term.n - 1) })}
                        >
                          −
                        </button>
                        <strong>{term.n}</strong>
                        <button
                          type="button"
                          aria-label="Mehr Würfel"
                          onClick={() => updateTerm(index, { n: clampCount(term.n + 1) })}
                        >
                          +
                        </button>
                      </div>
                      <div className="spike-chat-sides">
                        {ALLOWED_SIDES.map((sides) => (
                          <button
                            key={sides}
                            type="button"
                            aria-pressed={term.m === sides}
                            onClick={() => updateTerm(index, { m: sides })}
                          >
                            d{sides}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                  {diceDraft.terms.length < MAX_DICE_TERMS ? (
                    <button
                      type="button"
                      className="spike-chat-text-btn"
                      onClick={() =>
                        setDiceDraft((current) => ({
                          ...current,
                          terms: [...current.terms, { n: 1, m: 4 }],
                        }))
                      }
                    >
                      Weiteren Würfel
                    </button>
                  ) : null}
                  <div className="spike-chat-bonus-row">
                    <div className="spike-chat-bonus-block">
                      <span>Bonus</span>
                      <div className="spike-chat-stepper">
                        <button
                          type="button"
                          aria-label="Bonus verringern"
                          onClick={() =>
                            setDiceDraft((current) => ({
                              ...current,
                              modifier: clampModifier(current.modifier - 1),
                            }))
                          }
                        >
                          −
                        </button>
                        <strong>{diceDraft.modifier}</strong>
                        <button
                          type="button"
                          aria-label="Bonus erhöhen"
                          onClick={() =>
                            setDiceDraft((current) => ({
                              ...current,
                              modifier: clampModifier(current.modifier + 1),
                            }))
                          }
                        >
                          +
                        </button>
                      </div>
                      <p className="spike-chat-preview">{formatStructuredPreview(diceDraft)}</p>
                    </div>
                    <div
                      className={`spike-chat-dice-result${privateRoll ? "" : " empty"}${copiedHint ? " copied" : ""}`}
                      role={privateRoll ? "button" : undefined}
                      tabIndex={privateRoll ? 0 : undefined}
                      aria-live="polite"
                      aria-label={copiedHint ? "Kopiert" : "Wurfergebnis"}
                      onClick={() => void copyPrivateRoll()}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          void copyPrivateRoll();
                        }
                      }}
                    >
                      <p>{copiedHint ? "Kopiert" : (privateRoll ?? "—")}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="spike-chat-switch"
                    role="switch"
                    aria-checked={dicePostToChat}
                    onClick={() => void persistPostSwitch(!dicePostToChat)}
                  >
                    <span>Im Chat posten</span>
                    <span className={`spike-chat-switch-track${dicePostToChat ? " on" : ""}`} />
                  </button>
                </div>
                <div className="spike-chat-sheet-actions">
                  <button type="button" className="spike-chat-secondary" onClick={() => setSheet("none")}>
                    Abbrechen
                  </button>
                  <button type="button" className="spike-chat-roll" disabled={sending} onClick={() => void sendRoll()}>
                    Würfeln
                  </button>
                </div>
              </div>
            </section>
          ) : null}
        </div>
      ) : null}
    </main>
  );
}
