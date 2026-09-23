"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ChangeEvent, type FormEvent } from "react";
import {
  SheetBodyFields,
  fromAttributeInputs,
  toAttributeInputs,
  type TraitKey,
} from "@/components/sheet/SheetBodyFields";
import { Avatar } from "@/components/world/display";
import { IMAGE_ACCEPT } from "@/components/world/image-accept";
import {
  ATTRIBUTE_KEYS,
  ATTRIBUTE_LONG,
  ATTRIBUTE_MAX,
  ATTRIBUTE_MIN,
  CHARACTER_CLASS_MAX,
  CHARACTER_IMAGES_MAX,
  CHARACTER_NAME_MAX,
  IMAGE_CAPTION_MAX,
  firstDuplicate,
  type Ability,
  type Skill,
} from "@/lib/characters/sheet";
import { apiRequest, uploadImage, type ApiResult } from "@/lib/client/api";
import type { CharacterSheet } from "@/lib/domain/characters";
import { asRichDoc, type RichDoc } from "@/lib/editor/rich-text";
import "@/components/sheet/sheet.css";
import "./characters.css";

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

      <SheetBodyFields
        attributeInputs={attributeInputs}
        onAttributeInputsChange={setAttributeInputs}
        proficiency={proficiency}
        onProficiencyChange={setProficiency}
        skills={skills}
        onSkillsChange={setSkills}
        abilities={abilities}
        onAbilitiesChange={setAbilities}
        traits={traits}
        onTraitsChange={setTraits}
        bioInitial={asRichDoc(sheet.bioJson)}
        onBioChange={setBio}
        bioAriaLabel="Bio des Charakters"
      />

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
