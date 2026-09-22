"use client";

/** contentEditable composer: live *italic* / **bold**, sends markdown plain text. */

import { useEffect, useRef } from "react";
import {
  COMPOSER_MAX_LENGTH,
  getCaretMarkdownOffset,
  insertPlainTextAtCaret,
  markdownToEditorHtml,
  serializeEditor,
  setCaretMarkdownOffset,
} from "./composer-dom";

type Props = {
  value: string;
  onChange: (markdown: string) => void;
  disabled?: boolean;
  onSubmit: () => void;
  "aria-label"?: string;
};

const REPARSE_MS = 80;

export function RichComposer({
  value,
  onChange,
  disabled,
  onSubmit,
  "aria-label": ariaLabel = "Nachricht",
}: Props) {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const valueRef = useRef(value);
  const reparseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const composingRef = useRef(false);
  const skipReparseRef = useRef(false);

  valueRef.current = value;

  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    if (document.activeElement === el && value !== "" && serializeEditor(el) === value) {
      return;
    }
    // External clear (after send) or initial mount.
    if (serializeEditor(el) !== value) {
      skipReparseRef.current = true;
      el.innerHTML = markdownToEditorHtml(value);
      if (value === "" && document.activeElement === el) {
        // keep focus; caret at start
        const sel = window.getSelection();
        sel?.removeAllRanges();
        const range = document.createRange();
        range.selectNodeContents(el);
        range.collapse(true);
        sel?.addRange(range);
      }
    }
  }, [value]);

  useEffect(() => {
    return () => {
      if (reparseTimerRef.current) clearTimeout(reparseTimerRef.current);
    };
  }, []);

  function emitFromDom() {
    const el = editorRef.current;
    if (!el) return;
    let md = serializeEditor(el);
    if (md.length > COMPOSER_MAX_LENGTH) {
      md = md.slice(0, COMPOSER_MAX_LENGTH);
      const offset = Math.min(getCaretMarkdownOffset(el), COMPOSER_MAX_LENGTH);
      el.innerHTML = markdownToEditorHtml(md);
      setCaretMarkdownOffset(el, offset);
    }
    if (md !== valueRef.current) onChange(md);
    scheduleReparse();
  }

  function scheduleReparse() {
    if (composingRef.current || skipReparseRef.current) {
      skipReparseRef.current = false;
      return;
    }
    if (reparseTimerRef.current) clearTimeout(reparseTimerRef.current);
    reparseTimerRef.current = setTimeout(() => {
      reparseTimerRef.current = null;
      const el = editorRef.current;
      if (!el || composingRef.current) return;
      const md = serializeEditor(el);
      const html = markdownToEditorHtml(md);
      if (el.innerHTML === html) return;
      const offset = getCaretMarkdownOffset(el);
      el.innerHTML = html;
      setCaretMarkdownOffset(el, offset);
    }, REPARSE_MS);
  }

  return (
    <div
      ref={editorRef}
      className={`spike-chat-editor${value.trim() ? "" : " is-empty"}`}
      contentEditable={!disabled}
      role="textbox"
      aria-multiline="false"
      aria-label={ariaLabel}
      data-placeholder="Nachricht"
      suppressContentEditableWarning
      onInput={() => {
        if (skipReparseRef.current) {
          skipReparseRef.current = false;
          return;
        }
        emitFromDom();
      }}
      onCompositionStart={() => {
        composingRef.current = true;
      }}
      onCompositionEnd={() => {
        composingRef.current = false;
        emitFromDom();
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter" && !event.shiftKey) {
          event.preventDefault();
          if (!disabled && value.trim()) onSubmit();
        }
      }}
      onPaste={(event) => {
        event.preventDefault();
        const el = editorRef.current;
        if (!el || disabled) return;
        const plain = event.clipboardData.getData("text/plain").replace(/\r\n?/g, "\n");
        if (!plain) return;
        const current = serializeEditor(el);
        const room = COMPOSER_MAX_LENGTH - current.length;
        const clipped = plain.slice(0, Math.max(0, room + 200));
        insertPlainTextAtCaret(el, clipped);
        emitFromDom();
      }}
    />
  );
}
