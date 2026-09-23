"use client";

import type { ReactNode } from "react";
import { RichTextEditor, type MentionConfig } from "@/components/editor/RichTextEditor";
import {
  ABILITIES_MAX,
  ABILITY_TEXT_MAX,
  ATTRIBUTE_KEYS,
  ATTRIBUTE_LONG,
  ATTRIBUTE_MAX,
  ATTRIBUTE_MIN,
  ATTRIBUTE_SHORT,
  CHARACTER_TRAIT_MAX,
  PROFICIENCY_MAX,
  PROFICIENCY_MIN,
  SKILLS_MAX,
  SKILL_LEVELS,
  SKILL_LEVEL_LABEL,
  SKILL_NAME_MAX,
  attributeModifier,
  formatSigned,
  skillBonus,
  type Ability,
  type AttributeKey,
  type Attributes,
  type Skill,
} from "@/lib/characters/sheet";
import type { RichDoc } from "@/lib/editor/rich-text";
import "./sheet.css";

export type TraitKey = "personality" | "ideals" | "bonds" | "flaws";

export const SHEET_TRAIT_LABELS: [TraitKey, string][] = [
  ["personality", "Persönlichkeit"],
  ["ideals", "Ideale"],
  ["bonds", "Bindungen"],
  ["flaws", "Makel"],
];

export function toAttributeInputs(attributes: Attributes): Record<AttributeKey, string> {
  const inputs = {} as Record<AttributeKey, string>;
  for (const key of ATTRIBUTE_KEYS) inputs[key] = attributes[key] === null ? "" : String(attributes[key]);
  return inputs;
}

export function fromAttributeInputs(inputs: Record<AttributeKey, string>): Attributes {
  const attributes = {} as Attributes;
  for (const key of ATTRIBUTE_KEYS) {
    const value = inputs[key].trim();
    attributes[key] = value === "" ? null : Number(value);
  }
  return attributes;
}

/** Editable sheet fields: attributes, proficiency, skills, abilities, traits, bio. No portrait/images/API. */
export function SheetBodyFields({
  attributeInputs,
  onAttributeInputsChange,
  proficiency,
  onProficiencyChange,
  skills,
  onSkillsChange,
  abilities,
  onAbilitiesChange,
  traits,
  onTraitsChange,
  bioInitial,
  onBioChange,
  bioPlaceholder,
  bioAriaLabel,
  mentions,
  afterTraits,
}: {
  attributeInputs: Record<AttributeKey, string>;
  onAttributeInputsChange: (inputs: Record<AttributeKey, string>) => void;
  proficiency: string;
  onProficiencyChange: (value: string) => void;
  skills: Skill[];
  onSkillsChange: (skills: Skill[]) => void;
  abilities: Ability[];
  onAbilitiesChange: (abilities: Ability[]) => void;
  traits: Record<TraitKey, string>;
  onTraitsChange: (traits: Record<TraitKey, string>) => void;
  bioInitial: RichDoc | null;
  onBioChange: (doc: RichDoc) => void;
  bioPlaceholder?: string;
  bioAriaLabel?: string;
  /** When set, `@`-mentions are enabled (monsters); omit for characters (plain `@`). */
  mentions?: MentionConfig;
  afterTraits?: ReactNode;
}) {
  const attributes = fromAttributeInputs(attributeInputs);
  const proficiencyValue = Number(proficiency) || 0;

  const updateSkill = (index: number, change: Partial<Skill>) =>
    onSkillsChange(skills.map((entry, i) => (i === index ? { ...entry, ...change } : entry)));
  const updateAbility = (index: number, change: Partial<Ability>) =>
    onAbilitiesChange(abilities.map((entry, i) => (i === index ? { ...entry, ...change } : entry)));

  return (
    <>
      <div className="card stack">
        <h2 style={{ margin: 0 }}>Attribute</h2>
        <div className="attrs">
          {ATTRIBUTE_KEYS.map((key) => (
            <label key={key} className="attr">
              <div className="k">{ATTRIBUTE_SHORT[key]}</div>
              <input
                type="number"
                inputMode="numeric"
                min={ATTRIBUTE_MIN}
                max={ATTRIBUTE_MAX}
                value={attributeInputs[key]}
                aria-label={ATTRIBUTE_LONG[key]}
                onChange={(e) => onAttributeInputsChange({ ...attributeInputs, [key]: e.target.value })}
              />
              <div className="m">{formatSigned(attributeModifier(attributes[key]))}</div>
            </label>
          ))}
        </div>
        <label className="row">
          <span className="grow">Übungsbonus</span>
          <input
            type="number"
            inputMode="numeric"
            min={PROFICIENCY_MIN}
            max={PROFICIENCY_MAX}
            value={proficiency}
            onChange={(e) => onProficiencyChange(e.target.value)}
            style={{ width: 80 }}
            required
          />
        </label>
      </div>

      <div className="card stack">
        <div className="row">
          <h2 className="grow" style={{ margin: 0 }}>
            Fertigkeiten ({skills.length}/{SKILLS_MAX})
          </h2>
          <button
            type="button"
            className="btn sm"
            disabled={skills.length >= SKILLS_MAX}
            onClick={() => onSkillsChange([...skills, { name: "", level: "trained", attr: "str" }])}
          >
            ＋ Fertigkeit
          </button>
        </div>
        {skills.map((skill, index) => (
          <div key={index} className="skill-edit">
            <div className="sk-row">
              <input
                value={skill.name}
                onChange={(e) => updateSkill(index, { name: e.target.value })}
                placeholder="Name der Fertigkeit"
                aria-label="Name der Fertigkeit"
                maxLength={SKILL_NAME_MAX}
                className="grow"
              />
              <button
                type="button"
                className="btn icon"
                aria-label="Fertigkeit entfernen"
                onClick={() => onSkillsChange(skills.filter((_, i) => i !== index))}
              >
                ✕
              </button>
            </div>
            <div className="sk-row">
              <select
                value={skill.attr}
                aria-label="Attribut"
                onChange={(e) => updateSkill(index, { attr: e.target.value as AttributeKey })}
              >
                {ATTRIBUTE_KEYS.map((key) => (
                  <option key={key} value={key}>
                    {ATTRIBUTE_SHORT[key]}
                  </option>
                ))}
              </select>
              <select
                value={skill.level}
                aria-label="Stufe"
                onChange={(e) => updateSkill(index, { level: e.target.value as Skill["level"] })}
              >
                {SKILL_LEVELS.map((level) => (
                  <option key={level} value={level}>
                    {SKILL_LEVEL_LABEL[level]}
                  </option>
                ))}
              </select>
              <b className="sk-total" aria-label="Gesamtbonus">
                {formatSigned(skillBonus(skill, attributes, proficiencyValue))}
              </b>
            </div>
          </div>
        ))}
      </div>

      <div className="card stack">
        <div className="row">
          <h2 className="grow" style={{ margin: 0 }}>
            Fähigkeiten ({abilities.length}/{ABILITIES_MAX})
          </h2>
          <button
            type="button"
            className="btn sm"
            disabled={abilities.length >= ABILITIES_MAX}
            onClick={() => onAbilitiesChange([...abilities, { text: "", attr: "str" }])}
          >
            ＋ Fähigkeit
          </button>
        </div>
        {abilities.map((ability, index) => (
          <div key={index} className="skill-edit">
            <div className="sk-row">
              <input
                value={ability.text}
                onChange={(e) => updateAbility(index, { text: e.target.value })}
                placeholder="Fähigkeit"
                aria-label="Fähigkeit"
                maxLength={ABILITY_TEXT_MAX}
                className="grow"
              />
              <select
                value={ability.attr}
                aria-label="Attribut"
                onChange={(e) => updateAbility(index, { attr: e.target.value as AttributeKey })}
                style={{ flex: "0 0 80px" }}
              >
                {ATTRIBUTE_KEYS.map((key) => (
                  <option key={key} value={key}>
                    {ATTRIBUTE_SHORT[key]}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="btn icon"
                aria-label="Fähigkeit entfernen"
                onClick={() => onAbilitiesChange(abilities.filter((_, i) => i !== index))}
              >
                ✕
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="card stack">
        {SHEET_TRAIT_LABELS.map(([key, label]) => (
          <label key={key} className="stack" style={{ gap: 6 }}>
            <span className="field-label">{label}</span>
            <textarea
              value={traits[key]}
              onChange={(e) => onTraitsChange({ ...traits, [key]: e.target.value })}
              maxLength={CHARACTER_TRAIT_MAX}
              rows={2}
            />
          </label>
        ))}
      </div>
      {afterTraits}

      <div className="stack" style={{ gap: 6 }}>
        <span className="field-label">Bio</span>
        <RichTextEditor
          initialContent={bioInitial}
          onChange={({ doc }) => onBioChange(doc)}
          placeholder={bioPlaceholder ?? "Hintergrund, Herkunft, Geschichte …"}
          ariaLabel={bioAriaLabel ?? "Bio"}
          mentions={mentions}
        />
      </div>
    </>
  );
}
