import type { MentionOptions } from "@tiptap/extension-mention";
import {
  STUB_TITLE_MIN,
  mentionCategoryLabel,
  type MentionHit,
  type MentionableKind,
} from "@/lib/editor/mentions";

export type SuggestionItem =
  | { type: "hit"; hit: MentionHit }
  | { type: "create"; title: string };

type MentionAttrs = { id: string; label: string; kind: MentionableKind };

type RenderProps = {
  items: SuggestionItem[];
  query: string;
  command: (attrs: MentionAttrs) => void;
  clientRect?: (() => DOMRect | null) | null;
};

export type MentionSource = {
  search: (query: string) => Promise<MentionHit[]>;
  /** Present only when the writer may create articles (Spielleitung). */
  createStub: ((title: string) => Promise<MentionHit>) | null;
  onError: (message: string) => void;
};

/**
 * `@` suggestion list (erwaehnungen.md): query runs from `@` to the caret,
 * spaces allowed, confirm only with Enter or a tap. Without hits the
 * Spielleitung gets „Neuen Artikel anlegen“ with exactly the typed name.
 */
export function createMentionSuggestion(
  source: MentionSource,
): NonNullable<MentionOptions["suggestion"]> {
  return {
    char: "@",
    allowSpaces: true,
    items: async ({ query }): Promise<SuggestionItem[]> => {
      let hits: MentionHit[] = [];
      try {
        hits = await source.search(query);
      } catch {
        source.onError("Die Erwähnungssuche ist gerade nicht erreichbar.");
      }
      const items: SuggestionItem[] = hits.map((hit) => ({ type: "hit", hit }));
      const title = query.trim();
      if (items.length === 0 && source.createStub && title.length >= STUB_TITLE_MIN) {
        items.push({ type: "create", title });
      }
      return items;
    },
    render: () => {
      let popup: HTMLDivElement | null = null;
      let selected = 0;
      let current: RenderProps | null = null;
      let busy = false;

      const pick = async (item: SuggestionItem) => {
        const props = current;
        if (!props || busy) return;
        if (item.type === "hit") {
          props.command({ id: item.hit.id, label: item.hit.title, kind: item.hit.kind });
          return;
        }
        if (!source.createStub) return;
        busy = true;
        try {
          const created = await source.createStub(item.title);
          props.command({ id: created.id, label: created.title, kind: created.kind });
        } catch (error) {
          source.onError(
            error instanceof Error ? error.message : "Der Artikel konnte nicht angelegt werden.",
          );
        } finally {
          busy = false;
        }
      };

      const draw = () => {
        if (!popup || !current) return;
        renderList(popup, current, selected, (item) => void pick(item));
        place(popup, current.clientRect?.() ?? null);
      };

      return {
        onStart: (props) => {
          selected = 0;
          current = props as unknown as RenderProps;
          popup = document.createElement("div");
          popup.className = "mention-popup";
          popup.setAttribute("role", "listbox");
          popup.setAttribute("aria-label", "Erwähnungen");
          document.body.append(popup);
          draw();
        },
        onUpdate: (props) => {
          current = props as unknown as RenderProps;
          if (selected >= current.items.length) selected = 0;
          draw();
        },
        onKeyDown: ({ event }) => {
          if (!current || !popup) return false;
          const count = current.items.length;
          if (event.key === "ArrowDown" && count > 0) {
            selected = (selected + 1) % count;
            draw();
            return true;
          }
          if (event.key === "ArrowUp" && count > 0) {
            selected = (selected - 1 + count) % count;
            draw();
            return true;
          }
          if (event.key === "Enter") {
            const item = current.items[selected];
            if (!item) return false;
            void pick(item);
            return true;
          }
          if (event.key === "Escape") {
            popup.remove();
            popup = null;
            return true;
          }
          return false;
        },
        onExit: () => {
          popup?.remove();
          popup = null;
          current = null;
        },
      };
    },
  };
}

function renderList(
  el: HTMLElement,
  props: RenderProps,
  selected: number,
  onPick: (item: SuggestionItem) => void,
) {
  el.replaceChildren();
  if (props.items.length === 0) {
    const empty = document.createElement("div");
    empty.className = "mention-empty";
    empty.textContent =
      props.query.trim().length < STUB_TITLE_MIN ? "Tippe weiter …" : "Keine Treffer";
    el.append(empty);
    return;
  }
  props.items.forEach((item, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.setAttribute("role", "option");
    button.setAttribute("aria-selected", String(index === selected));
    button.className = index === selected ? "mention-item is-selected" : "mention-item";
    const title = document.createElement("span");
    title.className = "mention-item-title";
    const category = document.createElement("span");
    category.className = "mention-item-category";
    if (item.type === "hit") {
      title.textContent = item.hit.title;
      category.textContent = mentionCategoryLabel(item.hit);
    } else {
      button.classList.add("is-create");
      title.textContent = `＋ Neuen Artikel „${item.title}“ anlegen`;
    }
    button.append(title, category);
    button.addEventListener("mousedown", (event) => {
      event.preventDefault();
      onPick(item);
    });
    el.append(button);
  });
}

const POPUP_GAP = 6;
const VIEWPORT_PAD = 8;

function place(el: HTMLElement, rect: DOMRect | null) {
  if (!rect) return;
  const width = Math.min(el.offsetWidth || 320, window.innerWidth - VIEWPORT_PAD * 2);
  const height = el.offsetHeight;
  let left = rect.left;
  if (left + width > window.innerWidth - VIEWPORT_PAD) left = window.innerWidth - VIEWPORT_PAD - width;
  left = Math.max(VIEWPORT_PAD, left);
  let top = rect.bottom + POPUP_GAP;
  if (top + height > window.innerHeight - VIEWPORT_PAD && rect.top - POPUP_GAP - height > VIEWPORT_PAD) {
    top = rect.top - POPUP_GAP - height;
  }
  el.style.left = `${left}px`;
  el.style.top = `${top}px`;
}
