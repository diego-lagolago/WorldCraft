"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ChangeEvent, type FormEvent } from "react";
import { RichTextEditor } from "@/components/editor/RichTextEditor";
import { Avatar } from "@/components/world/display";
import { IMAGE_ACCEPT } from "@/components/world/image-accept";
import {
  ABILITIES_MAX,
  ABILITY_TEXT_MAX,
  ATTRIBUTE_KEYS,
  ATTRIBUTE_LONG,
  ATTRIBUTE_MAX,
  ATTRIBUTE_MIN,
  ATTRIBUTE_SHORT,
  CHARACTER_CLASS_MAX,
  CHARACTER_IMAGES_MAX,
  CHARACTER_NAME_MAX,
  CHARACTER_TRAIT_MAX,
  IMAGE_CAPTION_MAX,
  PROFICIENCY_MAX,
  PROFICIENCY_MIN,
  SKILLS_MAX,
  SKILL_LEVELS,
  SKILL_LEVEL_LABEL,
  SKILL_NAME_MAX,
  attributeModifier,
  firstDuplicate,
  formatSigned,
  skillBonus,
  type Ability,
  type AttributeKey,
  type Attributes,
  type Skill,
} from "@/lib/characters/sheet";
import { apiRequest, uploadImage, type ApiResult } from "@/lib/client/api";
import type { CharacterSheet } from "@/lib/domain/characters";
import { asRichDoc, type RichDoc } from "@/lib/editor/rich-text";
import "./characters.css";

type TraitKey = "personality" | "ideals" | "bonds" | "flaws";

const TRAITS: [TraitKey, string][] = [
  ["personality", "Persönlichkeit"],
  ["ideals", "Ideale"],
  ["bonds", "Bindungen"],
  ["flaws", "Makel"],
];

function toAttributeInputs(attributes: Attributes): Record<AttributeKey, string> {
  const inputs = {} as Record<AttributeKey, string>;
  for (const key of ATTRIBUTE_KEYS) inputs[key] = attributes[key] === null ? "" : String(attributes[key]);
  return inputs;
}

function fromAttributeInputs(inputs: Record<AttributeKey, string>): Attributes {
  const attributes = {} as Attributes;
  for (const key of ATTRIBUTE_KEYS) {
    const value = inputs[key].trim();
    attributes[key] = value === "" ? null : Number(value);
  }
  return attributes;
}

/** Owner-only edit form; the server repeats every check (Fachmodell 3.8). */
export function CharacterForm({ sheet, backHref }: { sheet: CharacterSheet; backHref: string }) {
  const router = useRouter();
  const [name, setName] = useState(sheet.name);
  const [className, setClassName] = useState(sheet.class ?? "");
  const [attributeInputs, setAttributeInputs] = useState(() => toAttributeInputs(sheet.attributes));
  const [proficiency, setProficiency] = useState(String(sheet.proficiencyBonus));
  const [skills, setSkills] = useState<Skill[]>(sheet.skills);
  const [abilities, setAbilities] = useState<Ability[]>(sheet.abilities);
  const [traits, setTraits] = useState<Record<TraitKey, string>>({
    personality: sheet.personality ?? "",
    ideals: sheet.ideals ?? "",
    bonds: sheet.bonds ?? "",
    flaws: sheet.flaws ?? "",
  });
  const [bio, setBio] = useState<RichDoc | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const attributes = fromAttributeInputs(attributeInputs);
  const proficiencyValue = Number(proficiency) || 0;
  const base = `/api/characters/${sheet.id}`;

  async function run<T>(request: Promise<ApiResult<T>>): Promise<ApiResult<T>> {
    setError(null);
    setSaved(false);
    setPending(true);
    const result = await request;
    setPending(false);
    if (!result.ok) setError(result.error);
    return result;
  }

  function localError(): string | null {
    for (const key of ATTRIBUTE_KEYS) {
      const value = attributes[key];
      if (value !== null && (!Number.isInteger(value) || value < ATTRIBUTE_MIN || value > ATTRIBUTE_MAX)) {
        return `${ATTRIBUTE_LONG[key]} muss zwischen ${ATTRIBUTE_MIN} und ${ATTRIBUTE_MAX} liegen.`;
      }
    }
    if (skills.some((skill) => !skill.name.trim())) return "Jede Fertigkeit braucht einen Namen.";
    if (abilities.some((ability) => !ability.text.trim())) return "Jede Fähigkeit braucht einen Text.";
    const skill = firstDuplicate(skills.map((entry) => entry.name.trim()));
    if (skill) return `Die Fertigkeit „${skill}“ gibt es doppelt.`;
    const ability = firstDuplicate(abilities.map((entry) => entry.text.trim()));
    if (ability) return `Die Fähigkeit „${ability}“ gibt es doppelt.`;
    return null;
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const problem = localError();
    if (problem) {
      setError(problem);
      return;
    }
    const result = await run(
      apiRequest(base, "PATCH", {
        name,
        class: className,
        attributes,
        proficiencyBonus: proficiencyValue,
        skills,
        abilities,
        ...traits,
        ...(bio ? { bio } : {}),
      }),
    );
    if (result.ok) {
      setSaved(true);
      router.refresh();
    }
  }

  async function onPortrait(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const result = await run(uploadImage({ file, kind: "character_portrait", targetId: sheet.id }));
    if (result.ok) router.refresh();
  }

  async function onRemovePortrait() {
    const result = await run(apiRequest(base, "PATCH", { removePortrait: true }));
    if (result.ok) router.refresh();
  }

  async function onAddImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const result = await run(uploadImage({ file, kind: "character_image", targetId: sheet.id }));
    if (result.ok) router.refresh();
  }

  async function onImage(imageId: string, method: "PATCH" | "DELETE", body?: unknown) {
    const result = await run(apiRequest(`${base}/images/${imageId}`, method, body));
    if (result.ok) router.refresh();
  }

  async function onDelete() {
    const typed = window.prompt(
      `Charakter „${sheet.name}“ endgültig löschen? Er verschwindet aus allen Welten, samt Tagebuch und Bildern. Zum Bestätigen den Namen eingeben:`,
    );
    if (typed === null) return;
    if (typed.trim() !== sheet.name) {
      setError("Der Name stimmt nicht überein. Nichts wurde gelöscht.");
      return;
    }
    const result = await run(apiRequest(base, "DELETE"));
    if (result.ok) {
      router.push("/characters");
      router.refresh();
    }
  }

  const updateSkill = (index: number, change: Partial<Skill>) =>
    setSkills((list) => list.map((entry, i) => (i === index ? { ...entry, ...change } : entry)));
  const updateAbility = (index: number, change: Partial<Ability>) =>
    setAbilities((list) => list.map((entry, i) => (i === index ? { ...entry, ...change } : entry)));

  return (
    <form className="stack" onSubmit={onSubmit}>
      <Link className="back" href={backHref}>
        ‹ Zurück
      </Link>
      <div className="card stack">
        <div className="row">
          <Avatar name={name || sheet.name} image={sheet.portraitId ? `/api/files/${sheet.portraitId}` : null} size="lg" />
          <div className="stack grow" style={{ gap: 6 }}>
            <label className="btn sm" style={{ alignSelf: "flex-start" }}>
              Porträt hochladen
              <input type="file" accept={IMAGE_ACCEPT} hidden onChange={onPortrait} disabled={pending} />
            </label>
            {sheet.portraitId ? (
              <button type="button" className="btn sm" style={{ alignSelf: "flex-start" }} onClick={onRemovePortrait}>
                Porträt entfernen
              </button>
            ) : null}
          </div>
        </div>
        <label className="stack" style={{ gap: 6 }}>
          <span className="field-label">Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={CHARACTER_NAME_MAX} required />
        </label>
        <label className="stack" style={{ gap: 6 }}>
          <span className="field-label">Klasse</span>
          <input value={className} onChange={(e) => setClassName(e.target.value)} maxLength={CHARACTER_CLASS_MAX} />
        </label>
      </div>

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
                onChange={(e) => setAttributeInputs((inputs) => ({ ...inputs, [key]: e.target.value }))}
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
            onChange={(e) => setProficiency(e.target.value)}
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
            onClick={() => setSkills((list) => [...list, { name: "", level: "trained", attr: "str" }])}
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
                onClick={() => setSkills((list) => list.filter((_, i) => i !== index))}
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
            onClick={() => setAbilities((list) => [...list, { text: "", attr: "str" }])}
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
                onClick={() => setAbilities((list) => list.filter((_, i) => i !== index))}
              >
                ✕
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="card stack">
        {TRAITS.map(([key, label]) => (
          <label key={key} className="stack" style={{ gap: 6 }}>
            <span className="field-label">{label}</span>
            <textarea
              value={traits[key]}
              onChange={(e) => setTraits((values) => ({ ...values, [key]: e.target.value }))}
              maxLength={CHARACTER_TRAIT_MAX}
              rows={2}
            />
          </label>
        ))}
      </div>

      <div className="stack" style={{ gap: 6 }}>
        <span className="field-label">Bio</span>
        <RichTextEditor
          initialContent={asRichDoc(sheet.bioJson)}
          onChange={({ doc }) => setBio(doc)}
          placeholder="Hintergrund, Herkunft, Geschichte …"
          ariaLabel="Bio des Charakters"
        />
      </div>

      {error ? (
        <p className="error-text" role="alert">
          {error}
        </p>
      ) : null}
      {saved ? (
        <p className="small muted" role="status">
          Gespeichert.
        </p>
      ) : null}
      <button type="submit" className="btn primary" disabled={pending || !name.trim()}>
        Speichern
      </button>

      <div className="card stack">
        <div className="row">
          <h2 className="grow" style={{ margin: 0 }}>
            Bilder ({sheet.images.length}/{CHARACTER_IMAGES_MAX})
          </h2>
          {sheet.images.length < CHARACTER_IMAGES_MAX ? (
            <label className="btn sm">
              ＋ Bild
              <input type="file" accept={IMAGE_ACCEPT} hidden onChange={onAddImage} disabled={pending} />
            </label>
          ) : null}
        </div>
        {sheet.images.length === 0 ? <span className="muted small">Noch keine Bilder.</span> : null}
        {sheet.images.map((image, index) => (
          <div key={image.id} className="row" style={{ alignItems: "flex-start" }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- served by /api/files */}
            <img
              src={`/api/files/${image.fileId}`}
              alt={image.caption ?? ""}
              style={{ width: 96, height: 72, objectFit: "cover", borderRadius: 10 }}
            />
            <div className="stack grow" style={{ gap: 6 }}>
              <input
                defaultValue={image.caption ?? ""}
                placeholder="Bildunterschrift"
                aria-label="Bildunterschrift"
                maxLength={IMAGE_CAPTION_MAX}
                onBlur={(e) => {
                  if (e.target.value.trim() !== (image.caption ?? "")) {
                    void onImage(image.id, "PATCH", { caption: e.target.value });
                  }
                }}
              />
              <div className="row">
                <button
                  type="button"
                  className="btn icon"
                  aria-label="Nach vorne"
                  disabled={pending || index === 0}
                  onClick={() => onImage(image.id, "PATCH", { move: "up" })}
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="btn icon"
                  aria-label="Nach hinten"
                  disabled={pending || index === sheet.images.length - 1}
                  onClick={() => onImage(image.id, "PATCH", { move: "down" })}
                >
                  ↓
                </button>
                <button
                  type="button"
                  className="btn icon"
                  aria-label="Bild löschen"
                  disabled={pending}
                  onClick={() => {
                    if (window.confirm("Dieses Bild löschen?")) void onImage(image.id, "DELETE");
                  }}
                >
                  🗑
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <button type="button" className="btn danger" disabled={pending} onClick={onDelete}>
        Charakter löschen
      </button>
    </form>
  );
}
