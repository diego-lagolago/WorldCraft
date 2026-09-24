// @vitest-environment happy-dom

import { act, createElement, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { usePendingImageUpload } from "./usePendingImageUpload";

function Probe() {
  const upload = usePendingImageUpload();
  useEffect(() => {
    upload.chooseFile(new File(["image"], "portrait.png", { type: "image/png" }));
    // This test deliberately chooses exactly one file during mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

describe("usePendingImageUpload", () => {
  it("releases a chosen preview URL when unmounted", async () => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    const create = vi.fn(() => "blob:test-preview");
    const revoke = vi.fn();
    vi.stubGlobal("URL", { createObjectURL: create, revokeObjectURL: revoke });
    const container = document.createElement("div");
    const root = createRoot(container);
    await act(async () => root.render(createElement(Probe)));
    await act(async () => root.unmount());
    expect(revoke).toHaveBeenCalledWith("blob:test-preview");
    vi.unstubAllGlobals();
  });
});
