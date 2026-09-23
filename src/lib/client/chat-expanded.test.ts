// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { writeExpanded } from "./chat-expanded";
import { parseExpanded } from "@/lib/chat/expanded-state";

const WORLD = "11111111-1111-4111-8111-111111111111";
const CH = "22222222-2222-4222-8222-222222222222";

function readCookie(): string | undefined {
  return document.cookie
    .split("; ")
    .find((row) => row.startsWith("chat-expanded="))
    ?.slice("chat-expanded=".length);
}

describe("chat-expanded", () => {
  it("writes the expand map as a cookie visible only on the world's chat page", () => {
    history.pushState({}, "", `/w/${WORLD}/chat`);
    writeExpanded(WORLD, { [CH]: true });
    expect(parseExpanded(readCookie())).toEqual({ [CH]: true });

    history.pushState({}, "", "/w/other/chat");
    expect(readCookie()).toBeUndefined();
  });
});
