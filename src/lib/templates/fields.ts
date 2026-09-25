/**
 * APP-TEMPLATE-VALIDATE / APP-TEMPLATE-SWITCH: keep or drop field values
 * against the current registry. Existence of ref targets is checked in the
 * domain layer (needs the world).
 */

import { fail, ok, type AuthzResult } from "@/lib/authz";
import { parseUuid } from "@/lib/http";
import {
  TEMPLATE_TEXT_MAX,
  templateOf,
  type TemplateRefTarget,
  type TemplateRefValue,
  type TemplateType,
} from "./registry";

export type StoredTemplateValue = string | TemplateRefValue;
export type StoredTemplateFields = Record<string, StoredTemplateValue>;

export function parseRefValue(value: unknown): TemplateRefValue | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if ((record.kind !== "article" && record.kind !== "character") || typeof record.id !== "string") {
    return null;
  }
  const id = parseUuid(record.id.trim());
  if (!id) return null;
  return { kind: record.kind, id };
}

function refKindAllowed(targets: readonly TemplateRefTarget[], kind: TemplateRefValue["kind"]): boolean {
  return targets.some((target) => target.kind === kind);
}

/** Unknown keys drop out; empty values drop out; a bad type or option is 400. */
export function parseTemplateFields(type: TemplateType, raw: unknown): AuthzResult<StoredTemplateFields> {
  const input =
    raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const out: StoredTemplateFields = {};
  for (const field of templateOf(type).fields) {
    const value = input[field.key];
    if (value === undefined || value === null || value === "") continue;
    if (field.type === "text") {
      if (typeof value !== "string") {
        return fail(400, `„${field.label}“ muss Text sein.`);
      }
      const trimmed = value.trim();
      if (!trimmed) continue;
      if (trimmed.length > TEMPLATE_TEXT_MAX) {
        return fail(400, `„${field.label}“ ist zu lang.`);
      }
      out[field.key] = trimmed;
      continue;
    }
    if (field.type === "select") {
      if (typeof value !== "string" || !field.options.some((option) => option.value === value)) {
        return fail(400, `„${field.label}“ hat keinen gültigen Wert.`);
      }
      out[field.key] = value;
      continue;
    }
    const ref = parseRefValue(value);
    if (!ref || !refKindAllowed(field.targets, ref.kind)) {
      return fail(400, `„${field.label}“ akzeptiert dieses Ziel nicht.`);
    }
    out[field.key] = ref;
  }
  return ok(out);
}

/**
 * Keeps only values that are structurally valid for a new template.
 *
 * Unlike `parseTemplateFields`, this is deliberately tolerant: it is only
 * used for stored values during a template switch, where incompatible values
 * must disappear instead of rejecting the whole article update.
 */
export function keepCompatibleFields(type: TemplateType, stored: unknown): StoredTemplateFields {
  const input =
    stored && typeof stored === "object" && !Array.isArray(stored) ? (stored as Record<string, unknown>) : {};
  const out: StoredTemplateFields = {};
  for (const field of templateOf(type).fields) {
    const value = input[field.key];
    if (field.type === "text") {
      if (typeof value !== "string") continue;
      const trimmed = value.trim();
      if (!trimmed || trimmed.length > TEMPLATE_TEXT_MAX) continue;
      out[field.key] = trimmed;
      continue;
    }
    if (field.type === "select") {
      if (typeof value === "string" && field.options.some((option) => option.value === value)) {
        out[field.key] = value;
      }
      continue;
    }
    const ref = parseRefValue(value);
    if (ref && refKindAllowed(field.targets, ref.kind)) out[field.key] = ref;
  }
  return out;
}

export function templateFieldsHaveValue(fields: StoredTemplateFields): boolean {
  return Object.keys(fields).length > 0;
}
