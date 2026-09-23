"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import {
  COMPOSER_MAX_LENGTH,
  getCaretMarkdownOffset,
  insertPlainTextAtCaret,
  markdownToEditorHtml,
  serializeEditor,
  setCaretMarkdownOffset,
} from "./composer-dom";

export type RichComposerHandle = { focus: () => void };

type Props = {
  value: string;
  onChange: (markdown: string) => void;
  disabled?: boolean;
  placeholder?: string;
  onSubmit: () => void;
};

const REPARSE_MS = 80;

function placeCaretAtStart(el: HTMLElement) {
  const sel = window.getSelection();
  sel?.removeAllRanges();
  const range = document.createRange();
  range.selectNodeContents(el);
  range.collapse(true);
  sel?.addRange(range);
}

export const RichComposer = forwardRef<RichComposerHandle, Props>(function RichComposer(
  { value, onChange, disabled, placeholder = "Nachricht", onSubmit },
  ref,
) {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const valueRef = useRef(value);
  const reparseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const composingRef = useRef(false);
  const skipReparseRef = useRef(false);

  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  useImperativeHandle(ref, () => ({
    focus: () => {
      const el = editorRef.current;
      if (!el) return;
      el.focus();
      placeCaretAtStart(el);
    },
  }));

  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    if (document.activeElement === el && value !== "" && serializeEditor(el) === value) return;
    if (serializeEditor(el) !== value) {
      skipReparseRef.current = true;
      el.innerHTML = markdownToEditorHtml(value);
      if (value === "" && document.activeElement === el) placeCaretAtStart(el);
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
      skipReparseRef.current = true;
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
      // Live bold/italic preview only — rewriting HTML without markers
      // collapses a trailing space and jumps the caret back onto the word.
      if (!md.includes("*")) return;
      const html = markdownToEditorHtml(md);
      if (el.innerHTML === html) return;
      const offset = getCaretMarkdownOffset(el);
      skipReparseRef.current = true;
      el.innerHTML = html;
      setCaretMarkdownOffset(el, offset);
    }, REPARSE_MS);
  }

  const isEmpty = value.trim().length === 0;

  return (
    <div
      ref={editorRef}
      className={`chat-editor${isEmpty ? " is-empty" : ""}`}
      contentEditable={!disabled}
      role="textbox"
      aria-multiline="true"
      aria-label="Nachricht"
      data-placeholder={placeholder}
      suppressContentEditableWarning
      onInput={() => emitFromDom()}
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
        const room = COMPOSER_MAX_LENGTH - serializeEditor(el).length;
        insertPlainTextAtCaret(el, plain.slice(0, Math.max(0, room + 200)));
        emitFromDom();
      }}
    />
  );
});
