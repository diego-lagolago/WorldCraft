"use client";

import { useEditorState, type Editor } from "@tiptap/react";
import {
  Bold,
  ChevronDown,
  Heading2,
  Heading3,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Minus,
  Quote,
  Strikethrough,
  Type,
  Underline,
  Unlink,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { normalizeLinkHref } from "@/lib/editor/links";

type GroupId = "format" | "lists" | "style" | "link";

const GROUP_LABEL: Record<GroupId, string> = {
  format: "Formatierung",
  lists: "Listen",
  style: "Stilmittel",
  link: "Link",
};

/** ADR-004 toolbar: exactly the allowed formats, grouped so it fits 390 px. */
export function Toolbar({ editor }: { editor: Editor }) {
  const [open, setOpen] = useState<GroupId | null>(null);
  const [hrefInput, setHrefInput] = useState("");
  const [hrefError, setHrefError] = useState(false);
  const selectionRef = useRef<{ from: number; to: number } | null>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttons: Record<GroupId, RefObject<HTMLButtonElement | null>> = {
    format: useRef<HTMLButtonElement>(null),
    lists: useRef<HTMLButtonElement>(null),
    style: useRef<HTMLButtonElement>(null),
    link: useRef<HTMLButtonElement>(null),
  };

  const active = useEditorState({
    editor,
    selector: ({ editor: ed }) => ({
      h2: ed.isActive("heading", { level: 2 }),
      h3: ed.isActive("heading", { level: 3 }),
      bold: ed.isActive("bold"),
      italic: ed.isActive("italic"),
      underline: ed.isActive("underline"),
      strike: ed.isActive("strike"),
      bullet: ed.isActive("bulletList"),
      ordered: ed.isActive("orderedList"),
      quote: ed.isActive("blockquote"),
      link: ed.isActive("link"),
      href: (ed.getAttributes("link").href as string | undefined) ?? "",
    }),
  });

  const close = useCallback(() => setOpen(null), []);

  const toggle = (id: GroupId) => {
    if (id === "link") {
      const { from, to } = editor.state.selection;
      selectionRef.current = { from, to };
      setHrefInput(active.href || "");
      setHrefError(false);
    }
    setOpen((current) => (current === id ? null : id));
  };

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (toolbarRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      close();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close]);

  const run = (command: () => void) => {
    command();
    close();
  };

  const selectionForLink = () => {
    const fallback = editor.state.selection;
    const from = selectionRef.current?.from ?? fallback.from;
    const to = selectionRef.current?.to ?? fallback.to;
    if (from !== to) return { from, to };
    const $from = editor.state.doc.resolve(from);
    return { from: $from.start(), to: $from.end() };
  };

  const applyLink = () => {
    const raw = hrefInput.trim();
    const chain = editor.chain().focus().setTextSelection(selectionForLink()).extendMarkRange("link");
    if (raw === "") {
      chain.unsetLink().run();
      close();
      return;
    }
    const href = normalizeLinkHref(raw);
    if (!href) {
      setHrefError(true);
      return;
    }
    chain.setLink({ href }).run();
    close();
  };

  const removeLink = () => {
    editor.chain().focus().setTextSelection(selectionForLink()).extendMarkRange("link").unsetLink().run();
    close();
  };

  const groupActive: Record<GroupId, boolean> = {
    format: active.h2 || active.h3 || active.bold || active.italic || active.underline || active.strike,
    lists: active.bullet || active.ordered,
    style: active.quote,
    link: active.link,
  };
  const groupIcon: Record<GroupId, ReactNode> = {
    format: <Type />,
    lists: <List />,
    style: <Quote />,
    link: <LinkIcon />,
  };

  return (
    <div ref={toolbarRef} className="editor-toolbar" role="toolbar" aria-label="Textformatierung">
      {(Object.keys(GROUP_LABEL) as GroupId[]).map((id) => (
        <GroupButton
          key={id}
          buttonRef={buttons[id]}
          label={GROUP_LABEL[id]}
          open={open === id}
          active={groupActive[id]}
          onToggle={() => toggle(id)}
        >
          {groupIcon[id]}
        </GroupButton>
      ))}

      {open
        ? createPortal(
            <ToolbarMenu menuRef={menuRef} anchorRef={buttons[open]} label={GROUP_LABEL[open]}>
              {open === "format" ? (
                <>
                  <MenuItem label="Überschrift 2" active={active.h2} icon={<Heading2 />}
                    onSelect={() => run(() => editor.chain().focus().toggleHeading({ level: 2 }).run())} />
                  <MenuItem label="Überschrift 3" active={active.h3} icon={<Heading3 />}
                    onSelect={() => run(() => editor.chain().focus().toggleHeading({ level: 3 }).run())} />
                  <MenuItem label="Fett" active={active.bold} icon={<Bold />}
                    onSelect={() => run(() => editor.chain().focus().toggleBold().run())} />
                  <MenuItem label="Kursiv" active={active.italic} icon={<Italic />}
                    onSelect={() => run(() => editor.chain().focus().toggleItalic().run())} />
                  <MenuItem label="Unterstrichen" active={active.underline} icon={<Underline />}
                    onSelect={() => run(() => editor.chain().focus().toggleUnderline().run())} />
                  <MenuItem label="Durchgestrichen" active={active.strike} icon={<Strikethrough />}
                    onSelect={() => run(() => editor.chain().focus().toggleStrike().run())} />
                </>
              ) : null}
              {open === "lists" ? (
                <>
                  <MenuItem label="Aufzählung" active={active.bullet} icon={<List />}
                    onSelect={() => run(() => editor.chain().focus().toggleBulletList().run())} />
                  <MenuItem label="Nummeriert" active={active.ordered} icon={<ListOrdered />}
                    onSelect={() => run(() => editor.chain().focus().toggleOrderedList().run())} />
                </>
              ) : null}
              {open === "style" ? (
                <>
                  <MenuItem label="Zitat" active={active.quote} icon={<Quote />}
                    onSelect={() => run(() => editor.chain().focus().toggleBlockquote().run())} />
                  <MenuItem label="Trennlinie" icon={<Minus />} checkbox={false}
                    onSelect={() => run(() => editor.chain().focus().setHorizontalRule().run())} />
                </>
              ) : null}
              {open === "link" ? (
                <div className="editor-link-form">
                  <label className="editor-link-label" htmlFor="editor-link-url">
                    URL
                  </label>
                  <input
                    id="editor-link-url"
                    className="editor-link-input"
                    type="text"
                    inputMode="url"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    autoFocus
                    placeholder="https://…"
                    value={hrefInput}
                    aria-invalid={hrefError}
                    onChange={(event) => {
                      setHrefInput(event.target.value);
                      setHrefError(false);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        applyLink();
                      }
                    }}
                  />
                  {hrefError ? (
                    <p className="editor-link-error">Nur Links mit http oder https sind erlaubt.</p>
                  ) : null}
                  <button type="button" className="editor-link-apply" onClick={applyLink}>
                    {active.link ? "Link ändern" : "Link setzen"}
                  </button>
                  <MenuItem label="Link entfernen" icon={<Unlink />} disabled={!active.link}
                    checkbox={false} onSelect={removeLink} />
                </div>
              ) : null}
            </ToolbarMenu>,
            document.body,
          )
        : null}
    </div>
  );
}

function GroupButton({
  buttonRef,
  label,
  open,
  active,
  onToggle,
  children,
}: {
  buttonRef: RefObject<HTMLButtonElement | null>;
  label: string;
  open: boolean;
  active: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <button
      ref={buttonRef}
      type="button"
      className={`editor-group${active ? " is-on" : ""}${open ? " is-open" : ""}`}
      aria-label={label}
      aria-haspopup="menu"
      aria-expanded={open}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onToggle}
    >
      <span className="editor-group-icon" aria-hidden="true">
        {children}
      </span>
      <ChevronDown className="editor-group-caret" aria-hidden="true" />
    </button>
  );
}

function MenuItem({
  label,
  icon,
  active,
  disabled,
  checkbox = true,
  onSelect,
}: {
  label: string;
  icon: ReactNode;
  active?: boolean;
  disabled?: boolean;
  checkbox?: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role={checkbox ? "menuitemcheckbox" : "menuitem"}
      aria-checked={checkbox ? Boolean(active) : undefined}
      className={`editor-menu-item${active ? " is-on" : ""}`}
      disabled={disabled}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onSelect}
    >
      <span className="editor-menu-icon" aria-hidden="true">
        {icon}
      </span>
      <span>{label}</span>
    </button>
  );
}

const MENU_PAD = 8;
const MENU_GAP = 6;

function ToolbarMenu({
  menuRef,
  anchorRef,
  label,
  children,
}: {
  menuRef: RefObject<HTMLDivElement | null>;
  anchorRef: RefObject<HTMLElement | null>;
  label: string;
  children: ReactNode;
}) {
  const labelId = useId();
  const [style, setStyle] = useState<CSSProperties>({ visibility: "hidden", top: 0, left: 0 });

  const place = useCallback(() => {
    const anchor = anchorRef.current;
    const menu = menuRef.current;
    if (!anchor || !menu) return;
    const a = anchor.getBoundingClientRect();
    const height = menu.offsetHeight;
    const width = menu.offsetWidth;
    let top = a.bottom + MENU_GAP;
    if (top + height > window.innerHeight - MENU_PAD) {
      const flipped = a.top - MENU_GAP - height;
      top = flipped >= MENU_PAD ? flipped : Math.max(MENU_PAD, window.innerHeight - MENU_PAD - height);
    }
    let left = a.left;
    if (left + width > window.innerWidth - MENU_PAD) left = window.innerWidth - MENU_PAD - width;
    if (left < MENU_PAD) left = MENU_PAD;
    setStyle({ position: "fixed", top, left, visibility: "visible" });
  }, [anchorRef, menuRef]);

  useLayoutEffect(() => {
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [place, children]);

  return (
    <div ref={menuRef} className="editor-menu" role="menu" aria-labelledby={labelId} style={style}>
      <span id={labelId} className="editor-menu-title">
        {label}
      </span>
      {children}
    </div>
  );
}
