import type { ReactNode } from "react";
import { RichTextView } from "@/components/editor/RichTextView";
import {
  ATTRIBUTE_KEYS,
  ATTRIBUTE_SHORT,
  SKILL_LEVEL_LABEL,
  attributeModifier,
  formatSigned,
  skillBonus,
  type Ability,
  type Attributes,
  type Skill,
} from "@/lib/characters/sheet";
import type { ResolvedMention } from "@/lib/domain/mention-resolve";
import { asRichDoc } from "@/lib/editor/rich-text";
import "./sheet.css";

export type SheetBodyData = {
  attributes: Attributes;
  proficiencyBonus: number;
  skills: Skill[];
  abilities: Ability[];
  personality: string | null;
  ideals: string | null;
  bonds: string | null;
  flaws: string | null;
  bioJson: unknown;
};

const TRAITS = [
  ["personality", "Persönlichkeit"],
  ["ideals", "Ideale"],
  ["bonds", "Bindungen"],
  ["flaws", "Makel"],
] as const;

/** Read-only sheet body: attributes, skills, abilities, traits, bio. No entity-specific chrome. */
export function SheetBodyView({
  sheet,
  bioEmpty,
  afterBio,
  mentions,
}: {
  sheet: SheetBodyData;
  bioEmpty?: ReactNode;
  afterBio?: ReactNode;
  /** When set (e.g. monster bio), `@`-mentions render as links. */
  mentions?: Record<string, ResolvedMention>;
}) {
  return (
    <div className="stack">
      <div className="attrs">
        {ATTRIBUTE_KEYS.map((key) => (
          <div key={key} className="attr">
            <div className="k">{ATTRIBUTE_SHORT[key]}</div>
            <div className="v">{sheet.attributes[key] ?? "–"}</div>
            <div className="m">{formatSigned(attributeModifier(sheet.attributes[key]))}</div>
          </div>
        ))}
      </div>

      <div className="card">
        <h2>Fertigkeiten</h2>
        {sheet.skills.length === 0 ? <div className="empty">Noch keine Fertigkeiten.</div> : null}
        {sheet.skills.map((skill) => (
          <div key={skill.name} className="skill">
            <span className="grow">
              {skill.name}{" "}
              <span className="kind">
                {ATTRIBUTE_SHORT[skill.attr]} {formatSigned(attributeModifier(sheet.attributes[skill.attr]))} ·{" "}
                <span className={`lvl ${skill.level}`}>{SKILL_LEVEL_LABEL[skill.level]}</span>
              </span>
            </span>
            <b className="sk-total">{formatSigned(skillBonus(skill, sheet.attributes, sheet.proficiencyBonus))}</b>
          </div>
        ))}
      </div>

      <div className="card">
        <h2>Fähigkeiten</h2>
        {sheet.abilities.length === 0 ? <div className="empty">Noch keine Fähigkeiten.</div> : null}
        {sheet.abilities.map((ability) => (
          <div key={ability.text} className="skill">
            <span className="grow">
              {ability.text} <span className="kind">{ATTRIBUTE_SHORT[ability.attr]}</span>
            </span>
            <b className="sk-total">{formatSigned(attributeModifier(sheet.attributes[ability.attr]))}</b>
          </div>
        ))}
      </div>

      <div className="card">
        <dl className="fields">
          {TRAITS.map(([key, label]) => (
            <div key={key} style={{ display: "contents" }}>
              <dt>{label}</dt>
              <dd style={{ whiteSpace: "pre-wrap" }}>{sheet[key] ?? <span className="muted">–</span>}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="card">
        <h2>Bio</h2>
        <RichTextView
          doc={asRichDoc(sheet.bioJson)}
          mentions={mentions}
          empty={bioEmpty ?? <p className="muted">Noch keine Bio.</p>}
        />
      </div>
      {afterBio}
    </div>
  );
}
