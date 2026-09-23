import Mention, { type MentionOptions } from "@tiptap/extension-mention";
import Placeholder from "@tiptap/extension-placeholder";
import StarterKit from "@tiptap/starter-kit";
import type { AnyExtension } from "@tiptap/core";
import { isAllowedLinkHref } from "@/lib/editor/links";
import type { MentionState } from "@/lib/editor/mentions";

/**
 * Mention with an English `kind` attribute (CONTENT_KINDS, CR-022). The
 * stub/linked colour comes from `resolveState` and is never stored in JSON.
 */
const WorldcraftMention = Mention.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      kind: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-kind"),
        renderHTML: (attributes) => (attributes.kind ? { "data-kind": attributes.kind } : {}),
      },
    };
  },
});

export type MentionExtensionConfig = {
  suggestion: NonNullable<MentionOptions["suggestion"]>;
  resolveState: (kind: string, id: string) => MentionState;
};

export function createEditorExtensions(options: {
  placeholder: string;
  mentions: MentionExtensionConfig | null;
}): AnyExtension[] {
  const base: AnyExtension[] = [
    StarterKit.configure({
      heading: { levels: [2, 3] },
      code: false,
      codeBlock: false,
      link: {
        openOnClick: false,
        autolink: true,
        defaultProtocol: "https",
        protocols: ["http", "https"],
        isAllowedUri: (url) => isAllowedLinkHref(url),
        HTMLAttributes: { rel: "noopener noreferrer nofollow", target: "_blank" },
      },
    }),
    Placeholder.configure({ placeholder: options.placeholder }),
  ];

  const mentions = options.mentions;
  if (!mentions) return base;

  return [
    ...base,
    WorldcraftMention.configure({
      renderText({ node }) {
        return `@${node.attrs.label ?? node.attrs.id}`;
      },
      renderHTML({ node }) {
        const state = mentions.resolveState(String(node.attrs.kind), String(node.attrs.id));
        return [
          "span",
          {
            class: state === "stub" ? "mention mention-stub" : "mention",
            "data-type": "mention",
            "data-id": node.attrs.id,
            "data-kind": node.attrs.kind,
          },
          String(node.attrs.label ?? node.attrs.id),
        ];
      },
      suggestion: mentions.suggestion,
    }),
  ];
}
