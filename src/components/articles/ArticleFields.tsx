import Link from "next/link";
import type { ReactNode } from "react";
import type { ResolvedMention } from "@/lib/domain/mention-resolve";
import { mentionKey } from "@/lib/editor/mentions";
import { MonsterRarityPill } from "@/components/monsters/MonsterRarityPill";
import { isMonsterRarity } from "@/lib/monsters/labels";
import type { StoredTemplateFields, StoredTemplateValue } from "@/lib/templates/fields";
import { templateOf, type TemplateField, type TemplateType } from "@/lib/templates/registry";

function formatValue(
  field: TemplateField,
  value: StoredTemplateValue | undefined,
  mentions: Record<string, ResolvedMention>,
): ReactNode {
  if (value === undefined || value === "") return <span className="muted">–</span>;
  if (field.type === "select" && typeof value === "string") {
    if (field.display === "rarity" && isMonsterRarity(value)) {
      return <MonsterRarityPill rarity={value} />;
    }
    return field.options.find((option) => option.value === value)?.label ?? value;
  }
  if (field.type === "ref" && typeof value === "object") {
    const resolved = mentions[mentionKey({ kind: value.kind, id: value.id })];
    if (!resolved || resolved.state === "plain") return "–";
    return (
      <Link href={resolved.href} className={resolved.state === "stub" ? "mention mention-stub" : "mention"}>
        {resolved.title}
      </Link>
    );
  }
  return typeof value === "string" ? value : "–";
}

export function ArticleFields({
  templateType,
  fields,
  mentions,
}: {
  templateType: TemplateType | string;
  fields: StoredTemplateFields;
  mentions: Record<string, ResolvedMention>;
}) {
  const template = templateOf(typeof templateType === "string" ? templateType : templateType);
  if (template.fields.length === 0) return null;
  return (
    <div className="card">
      <dl className="fields">
        {template.fields.map((field) => (
          <div key={field.key} style={{ display: "contents" }}>
            <dt>{field.label}</dt>
            <dd>{formatValue(field, fields[field.key], mentions)}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
