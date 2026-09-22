import { useEditorState, type Editor } from '@tiptap/react';
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
} from 'lucide-react';
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
} from 'react';
import { createPortal } from 'react-dom';

type Props = {
  editor: Editor;
};

type GroupId = 'format' | 'lists' | 'style' | 'link';

type ActiveState = {
  h2: boolean;
  h3: boolean;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strike: boolean;
  bullet: boolean;
  ordered: boolean;
  quote: boolean;
  link: boolean;
  href: string;
};

export function Toolbar({ editor }: Props) {
  const [open, setOpen] = useState<GroupId | null>(null);
  const [hrefInput, setHrefInput] = useState('');
  const selectionRef = useRef<{ from: number; to: number } | null>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const formatBtn = useRef<HTMLButtonElement>(null);
  const listsBtn = useRef<HTMLButtonElement>(null);
  const styleBtn = useRef<HTMLButtonElement>(null);
  const linkBtn = useRef<HTMLButtonElement>(null);

  const active = useEditorState({
    editor,
    selector: ({ editor: ed }): ActiveState => ({
      h2: ed.isActive('heading', { level: 2 }),
      h3: ed.isActive('heading', { level: 3 }),
      bold: ed.isActive('bold'),
      italic: ed.isActive('italic'),
      underline: ed.isActive('underline'),
      strike: ed.isActive('strike'),
      bullet: ed.isActive('bulletList'),
      ordered: ed.isActive('orderedList'),
      quote: ed.isActive('blockquote'),
      link: ed.isActive('link'),
      href: (ed.getAttributes('link').href as string | undefined) ?? '',
    }),
  });

  const close = useCallback(() => setOpen(null), []);

  const toggle = (id: GroupId) => {
    if (id === 'link') {
      const { from, to } = editor.state.selection;
      selectionRef.current = { from, to };
      setHrefInput(active.href || '');
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
      if (event.key === 'Escape') close();
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKey);
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
    const url = hrefInput.trim();
    const sel = selectionForLink();
    let chain = editor.chain().focus().setTextSelection(sel);
    if (url === '') {
      chain.extendMarkRange('link').unsetLink().run();
    } else {
      chain.extendMarkRange('link').setLink({ href: url }).run();
    }
    close();
  };

  const removeLink = () => {
    const sel = selectionForLink();
    editor.chain().focus().setTextSelection(sel).extendMarkRange('link').unsetLink().run();
    close();
  };

  const anchor =
    open === 'format'
      ? formatBtn
      : open === 'lists'
        ? listsBtn
        : open === 'style'
          ? styleBtn
          : open === 'link'
            ? linkBtn
            : null;

  return (
    <div ref={toolbarRef} className="toolbar" role="toolbar" aria-label="Textformatierung">
      <GroupButton
        buttonRef={formatBtn}
        label="Formatierung"
        open={open === 'format'}
        active={active.h2 || active.h3 || active.bold || active.italic || active.underline || active.strike}
        onToggle={() => toggle('format')}
      >
        <Type />
      </GroupButton>
      <GroupButton
        buttonRef={listsBtn}
        label="Listen"
        open={open === 'lists'}
        active={active.bullet || active.ordered}
        onToggle={() => toggle('lists')}
      >
        <List />
      </GroupButton>
      <GroupButton
        buttonRef={styleBtn}
        label="Stilmittel"
        open={open === 'style'}
        active={active.quote}
        onToggle={() => toggle('style')}
      >
        <Quote />
      </GroupButton>
      <GroupButton
        buttonRef={linkBtn}
        label="Link"
        open={open === 'link'}
        active={active.link}
        onToggle={() => toggle('link')}
      >
        <LinkIcon />
      </GroupButton>

      {open && anchor
        ? createPortal(
            <ToolbarMenu
              menuRef={menuRef}
              anchorRef={anchor}
              label={
                open === 'format'
                  ? 'Formatierung'
                  : open === 'lists'
                    ? 'Listen'
                    : open === 'style'
                      ? 'Stilmittel'
                      : 'Link'
              }
            >
              {open === 'format' ? (
                <>
                  <MenuItem
                    label="H2"
                    active={active.h2}
                    icon={<Heading2 />}
                    onSelect={() => run(() => editor.chain().focus().toggleHeading({ level: 2 }).run())}
                  />
                  <MenuItem
                    label="H3"
                    active={active.h3}
                    icon={<Heading3 />}
                    onSelect={() => run(() => editor.chain().focus().toggleHeading({ level: 3 }).run())}
                  />
                  <MenuItem
                    label="Fett"
                    active={active.bold}
                    icon={<Bold />}
                    onSelect={() => run(() => editor.chain().focus().toggleBold().run())}
                  />
                  <MenuItem
                    label="Kursiv"
                    active={active.italic}
                    icon={<Italic />}
                    onSelect={() => run(() => editor.chain().focus().toggleItalic().run())}
                  />
                  <MenuItem
                    label="Unterstrichen"
                    active={active.underline}
                    icon={<Underline />}
                    onSelect={() => run(() => editor.chain().focus().toggleUnderline().run())}
                  />
                  <MenuItem
                    label="Durchgestrichen"
                    active={active.strike}
                    icon={<Strikethrough />}
                    onSelect={() => run(() => editor.chain().focus().toggleStrike().run())}
                  />
                </>
              ) : null}
              {open === 'lists' ? (
                <>
                  <MenuItem
                    label="Aufzählung"
                    active={active.bullet}
                    icon={<List />}
                    onSelect={() => run(() => editor.chain().focus().toggleBulletList().run())}
                  />
                  <MenuItem
                    label="Nummeriert"
                    active={active.ordered}
                    icon={<ListOrdered />}
                    onSelect={() => run(() => editor.chain().focus().toggleOrderedList().run())}
                  />
                </>
              ) : null}
              {open === 'style' ? (
                <>
                  <MenuItem
                    label="Zitat"
                    active={active.quote}
                    icon={<Quote />}
                    onSelect={() => run(() => editor.chain().focus().toggleBlockquote().run())}
                  />
                  <MenuItem
                    label="Trennlinie"
                    icon={<Minus />}
                    checkbox={false}
                    onSelect={() => run(() => editor.chain().focus().setHorizontalRule().run())}
                  />
                </>
              ) : null}
              {open === 'link' ? (
                <div className="toolbar-link-form">
                  <label className="toolbar-link-label" htmlFor="toolbar-link-url">
                    URL
                  </label>
                  <input
                    id="toolbar-link-url"
                    className="toolbar-link-input"
                    type="text"
                    inputMode="url"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    autoFocus
                    placeholder="https://…"
                    value={hrefInput}
                    onChange={(event) => setHrefInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        applyLink();
                      }
                    }}
                  />
                  <button type="button" className="toolbar-link-apply" onClick={applyLink}>
                    {active.link ? 'Link bearbeiten' : 'Link setzen'}
                  </button>
                  <MenuItem
                    label="Link entfernen"
                    active={false}
                    icon={<Unlink />}
                    disabled={!active.link}
                    checkbox={false}
                    onSelect={removeLink}
                  />
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
      className={`toolbar-group${active ? ' is-on' : ''}${open ? ' is-open' : ''}`}
      aria-label={label}
      aria-haspopup="menu"
      aria-expanded={open}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onToggle}
    >
      <span className="toolbar-group-icon" aria-hidden="true">
        {children}
      </span>
      <ChevronDown className="toolbar-group-caret" aria-hidden="true" />
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
      role={checkbox ? 'menuitemcheckbox' : 'menuitem'}
      aria-checked={checkbox ? Boolean(active) : undefined}
      aria-label={label}
      className={`toolbar-menu-item${active ? ' is-on' : ''}`}
      disabled={disabled}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onSelect}
    >
      <span className="toolbar-menu-icon" aria-hidden="true">
        {icon}
      </span>
      <span className="toolbar-menu-label">{label}</span>
    </button>
  );
}

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
  const labelledBy = useId();
  const [style, setStyle] = useState<CSSProperties>({
    visibility: 'hidden',
    top: 0,
    left: 0,
  });

  const place = useCallback(() => {
    const anchor = anchorRef.current;
    const menu = menuRef.current;
    if (!anchor || !menu) return;
    const pad = 8;
    const gap = 6;
    const a = anchor.getBoundingClientRect();
    const m = menu.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const height = m.height || menu.offsetHeight;
    const width = m.width || menu.offsetWidth;

    let top = a.bottom + gap;
    if (top + height > vh - pad) {
      const flipped = a.top - gap - height;
      top = flipped >= pad ? flipped : Math.max(pad, vh - pad - height);
    }

    let left = a.left;
    if (left + width > vw - pad) left = vw - pad - width;
    if (left < pad) left = pad;

    setStyle({ position: 'fixed', top, left, visibility: 'visible' });
  }, [anchorRef, menuRef]);

  useLayoutEffect(() => {
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [place, children]);

  return (
    <div
      ref={menuRef}
      className="toolbar-menu"
      role="menu"
      aria-label={label}
      aria-labelledby={labelledBy}
      style={style}
    >
      <span id={labelledBy} className="toolbar-menu-title">
        {label}
      </span>
      {children}
    </div>
  );
}
