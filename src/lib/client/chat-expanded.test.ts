// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from "vitest";
import { readExpanded, writeExpanded } from "./chat-expanded";

beforeEach(() => localStorage.clear());

describe("chat-expanded", () => {
  it("reads and writes the expand map", () => {
    expect(readExpanded()).toEqual({});
    writeExpanded({ "ch-1": true, "ch-2": false });
    expect(readExpanded()).toEqual({ "ch-1": true, "ch-2": false });
  });

  it("returns empty object for bad JSON", () => {
    localStorage.setItem("worldcraft:chat-expanded", "{not-json");
    expect(readExpanded()).toEqual({});
  });

  it("returns empty object for non-object JSON", () => {
    localStorage.setItem("worldcraft:chat-expanded", "[]");
    expect(readExpanded()).toEqual({});
    localStorage.setItem("worldcraft:chat-expanded", '"yes"');
    expect(readExpanded()).toEqual({});
  });
});
