import { fail, ok, type AuthzResult } from "@/lib/authz";
import type { MentionRef } from "@/lib/editor/mentions";
import { sanitizeRichDoc, type RichDoc } from "@/lib/editor/rich-text";

export type RichFieldValue = { json: RichDoc | null; plain: string | null; mentions: MentionRef[] };

/**
 * APP-PLAIN: turns editor JSON from a request into the stored pair. `null`
 * clears the field; a document without text and mentions is stored as empty.
 */
export function richFieldFromInput(input: unknown, options: { mentions: boolean }): AuthzResult<RichFieldValue> {
  if (input === null) return ok({ json: null, plain: null, mentions: [] });
  const result = sanitizeRichDoc(input, options);
  if (!result.ok) return fail(400, result.error);
  const { doc, plain, mentions } = result.value;
  if (!plain && mentions.length === 0) return ok({ json: null, plain: null, mentions: [] });
  return ok({ json: doc, plain, mentions });
}
