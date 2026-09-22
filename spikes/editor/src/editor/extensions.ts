import Link from '@tiptap/extension-link';
import Mention from '@tiptap/extension-mention';
import Placeholder from '@tiptap/extension-placeholder';
import Underline from '@tiptap/extension-underline';
import StarterKit from '@tiptap/starter-kit';
import { mentionSuggestion } from './mention-suggestion';

const WorldcraftMention = Mention.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      art: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-art'),
        renderHTML: (attributes) => (attributes.art ? { 'data-art': attributes.art } : {}),
      },
    };
  },
});

export function createExtensions(options: { mentions: boolean; placeholder: string }) {
  const base = [
    StarterKit.configure({
      heading: { levels: [2, 3] },
      code: false,
      codeBlock: false,
    }),
    Underline,
    Link.configure({
      openOnClick: false,
      autolink: true,
      defaultProtocol: 'https',
      protocols: ['http', 'https'],
      HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' },
    }),
    Placeholder.configure({ placeholder: options.placeholder }),
  ];

  if (!options.mentions) return base;

  return [
    ...base,
    WorldcraftMention.configure({
      HTMLAttributes: { class: 'mention' },
      renderText({ node }) {
        return `@${node.attrs.label ?? node.attrs.id}`;
      },
      suggestion: mentionSuggestion(),
    }),
  ];
}
