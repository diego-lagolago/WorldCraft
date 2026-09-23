/** Pure decision helpers for QuestNotesSheet (Plan 004 CR-001, CR-017). */

import type { ResolvedMention } from "@/lib/domain/mention-resolve";

export type QuestNoteView = {
  bodyJson: unknown;
  version: number;
  updatedAt: string | null;
  updatedByName: string | null;
  mentions: Record<string, ResolvedMention>;
};

export type NoteSaveOutcome =
  | { action: "success"; note: QuestNoteView }
  | { action: "conflict" }
  | { action: "error"; error: string };

export type NoteReloadOutcome =
  | { action: "success"; note: QuestNoteView }
  | { action: "error"; error: string };

/** Ensures nullable fields have defaults; dates must already be ISO strings from the server. */
export function prepareNoteView(note: QuestNoteView): QuestNoteView {
  return {
    bodyJson: note.bodyJson,
    version: note.version,
    updatedAt: note.updatedAt,
    updatedByName: note.updatedByName ?? null,
    mentions: note.mentions ?? {},
  };
}

/**
 * CR-001: on 409 set conflict without bumping local version.
 * Save stays disabled until reload.
 */
export function interpretNoteSave(input: {
  ok: boolean;
  status?: number;
  data?: { note: QuestNoteView };
  error?: string;
}): NoteSaveOutcome {
  if (input.ok && input.data) {
    return { action: "success", note: prepareNoteView(input.data.note) };
  }
  if (input.status === 409) {
    return { action: "conflict" };
  }
  return { action: "error", error: input.error ?? "Speichern fehlgeschlagen." };
}

export function interpretNoteReload(input: {
  ok: boolean;
  data?: { note: QuestNoteView };
  error?: string;
}): NoteReloadOutcome {
  if (input.ok && input.data) {
    return { action: "success", note: prepareNoteView(input.data.note) };
  }
  return { action: "error", error: input.error ?? "Neu laden fehlgeschlagen." };
}

export function noteSaveDisabled(pending: boolean, conflict: boolean): boolean {
  return pending || conflict;
}
