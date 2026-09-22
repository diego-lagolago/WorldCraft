import type { MentionOptions } from '@tiptap/extension-mention';
import { searchMentions } from './search-mentions';
import { TEST_INHALTE } from './test-data';
import { categoryLabel, type MentionItem } from './types';

type SuggestionProps = {
  items: MentionItem[];
  command: (item: { id: string; label: string; art: MentionItem['art'] }) => void;
  clientRect?: (() => DOMRect | null) | null;
  editor: { view: { dom: HTMLElement } };
};

function renderList(el: HTMLElement, items: MentionItem[], selected: number, onPick: (item: MentionItem) => void) {
  el.replaceChildren();
  if (items.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'mention-empty';
    empty.textContent = 'Keine Treffer';
    el.append(empty);
    return;
  }
  items.forEach((item, index) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = index === selected ? 'mention-item is-selected' : 'mention-item';
    btn.innerHTML = `<span class="mention-title">${escapeHtml(item.title)}</span><span class="mention-cat">${escapeHtml(categoryLabel(item))}</span>`;
    btn.addEventListener('mousedown', (e) => {
      e.preventDefault();
      onPick(item);
    });
    el.append(btn);
  });
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function place(el: HTMLElement, rect: DOMRect | null) {
  if (!rect) return;
  el.style.left = `${rect.left + window.scrollX}px`;
  el.style.top = `${rect.bottom + window.scrollY + 4}px`;
}

export function mentionSuggestion(): NonNullable<MentionOptions['suggestion']> {
  return {
    char: '@',
    allowSpaces: true,
    items: ({ query }) => searchMentions(TEST_INHALTE, query),
    render: () => {
      let popup: HTMLDivElement | null = null;
      let selected = 0;
      let current: SuggestionProps | null = null;

      const pick = (item: MentionItem) => {
        current?.command({ id: item.id, label: item.title, art: item.art });
      };

      const refresh = (props: SuggestionProps) => {
        current = props;
        if (selected >= props.items.length) selected = 0;
        if (popup) {
          renderList(popup, props.items, selected, pick);
          place(popup, props.clientRect?.() ?? null);
        }
      };

      return {
        onStart: (props) => {
          selected = 0;
          popup = document.createElement('div');
          popup.className = 'mention-popup';
          popup.setAttribute('role', 'listbox');
          document.body.append(popup);
          refresh(props as unknown as SuggestionProps);
        },
        onUpdate: (props) => {
          refresh(props as unknown as SuggestionProps);
        },
        onKeyDown: ({ event }) => {
          if (!current || !popup) return false;
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            selected = (selected + 1) % Math.max(current.items.length, 1);
            renderList(popup, current.items, selected, pick);
            return true;
          }
          if (event.key === 'ArrowUp') {
            event.preventDefault();
            selected =
              (selected - 1 + Math.max(current.items.length, 1)) %
              Math.max(current.items.length, 1);
            renderList(popup, current.items, selected, pick);
            return true;
          }
          if (event.key === 'Enter') {
            const item = current.items[selected];
            if (item) {
              event.preventDefault();
              pick(item);
              return true;
            }
          }
          if (event.key === 'Escape') {
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
