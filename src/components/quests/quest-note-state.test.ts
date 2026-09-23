import { describe, expect, it } from "vitest";
import {
  interpretNoteReload,
  interpretNoteSave,
  noteSaveDisabled,
  prepareNoteView,
  type QuestNoteView,
} from "./quest-note-state";

const note: QuestNoteView = {
  bodyJson: { type: "doc", content: [] },
  version: 2,
  updatedAt: "2026-09-23T10:00:00.000Z",
  updatedByName: "Alice",
  mentions: {},
};

describe("prepareNoteView", () => {
  it("defaults nullable fields without touching updatedAt", () => {
    expect(
      prepareNoteView({
        bodyJson: null,
        version: 0,
        updatedAt: null,
        updatedByName: undefined as unknown as null,
        mentions: undefined as unknown as Record<string, never>,
      }),
    ).toEqual({
      bodyJson: null,
      version: 0,
      updatedAt: null,
      updatedByName: null,
      mentions: {},
    });
  });
});

describe("interpretNoteSave (CR-001)", () => {
  it("accepts a successful save and normalizes the note", () => {
    expect(
      interpretNoteSave({
        ok: true,
        data: { note: { ...note, updatedByName: undefined as unknown as null } },
      }),
    ).toEqual({
      action: "success",
      note: { ...note, updatedByName: null },
    });
  });

  it("returns conflict on 409 without a server version bump hint", () => {
    expect(
      interpretNoteSave({
        ok: false,
        status: 409,
        error: "Die Notiz wurde inzwischen geändert.",
      }),
    ).toEqual({ action: "conflict" });
  });

  it("returns error for other failures", () => {
    expect(
      interpretNoteSave({ ok: false, status: 500, error: "Serverfehler" }),
    ).toEqual({ action: "error", error: "Serverfehler" });
  });
});

describe("interpretNoteReload", () => {
  it("loads the server note and clears conflict state in the caller", () => {
    expect(
      interpretNoteReload({
        ok: true,
        data: { note },
      }),
    ).toEqual({ action: "success", note });
  });

  it("returns error when reload fails", () => {
    expect(
      interpretNoteReload({ ok: false, error: "Nicht gefunden" }),
    ).toEqual({ action: "error", error: "Nicht gefunden" });
  });
});

describe("noteSaveDisabled", () => {
  it("blocks save while pending or in conflict", () => {
    expect(noteSaveDisabled(true, false)).toBe(true);
    expect(noteSaveDisabled(false, true)).toBe(true);
    expect(noteSaveDisabled(false, false)).toBe(false);
  });
});
