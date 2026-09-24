"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ImageUploadField } from "@/components/files/ImageUploadField";
import {
  SheetBodyFields,
  fromAttributeInputs,
  toAttributeInputs,
  type TraitKey,
} from "@/components/sheet/SheetBodyFields";
import { worldPath } from "@/components/shell/nav";
import { Avatar } from "@/components/world/display";
import { ContentVisibilitySelect } from "@/components/world/VisibilitySelect";
import type { ContentVisibility } from "@/lib/authz/types";
import { contentHref } from "@/lib/content-href";
import {
  CHARACTER_CLASS_MAX,
  CHARACTER_NAME_MAX,
  EMPTY_ATTRIBUTES,
  PROFICIENCY_DEFAULT,
  sheetLocalError,
  type Ability,
  type Attributes,
  type Skill,
} from "@/lib/characters/sheet";
import { apiRequest } from "@/lib/client/api";
import { finishCreateWithImage } from "@/lib/client/finish-create-with-image";
import { usePendingImageUpload } from "@/lib/client/usePendingImageUpload";
import {
  MONSTER_DANGERS,
  MONSTER_DANGER_LABEL,
  MONSTER_KINDS,
  MONSTER_KIND_LABEL,
  MONSTER_RARITIES,
  MONSTER_RARITY_LABEL,
  MONSTER_SIZES,
  MONSTER_SIZE_LABEL,
  type MonsterDanger,
  type MonsterKind,
  type MonsterRarity,
  type MonsterSize,
} from "@/lib/monsters/labels";
import type { MentionState } from "@/lib/editor/mentions";
import { asRichDoc, type RichDoc } from "@/lib/editor/rich-text";
import "@/components/sheet/sheet.css";

type HabitatOption = { id: string; title: string };

type Monster = {
  id: string;
  name: string;
  class: string | null;
  visibility: ContentVisibility;
  ownerId: string;
  portraitId: string | null;
  kind: MonsterKind;
  rarity: MonsterRarity;
  isBoss: boolean;
  danger: MonsterDanger;
  size: MonsterSize;
  habitatArticleId: string | null;
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

export function MonsterForm({
  worldId,
  monster,
  actorId,
  placeOptions,
  currentHabitat,
  mentionStates,
  initialError,
}: {
  worldId: string;
  monster?: Monster;
  actorId: string;
  placeOptions: HabitatOption[];
  /** A readable habitat whose article is no longer a place. */
  currentHabitat?: HabitatOption | null;
  mentionStates?: Record<string, MentionState>;
  initialError?: string;
}) {
  const router = useRouter();
  const [name, setName] = useState(monster?.name ?? "");
  const [className, setClassName] = useState(monster?.class ?? "");
  const [visibility, setVisibility] = useState<ContentVisibility>(monster?.visibility ?? "owner_only");
  const [kind, setKind] = useState<MonsterKind>(monster?.kind ?? "other");
  const [rarity, setRarity] = useState<MonsterRarity>(monster?.rarity ?? "common");
  const [isBoss, setIsBoss] = useState(monster?.isBoss ?? false);
  const [danger, setDanger] = useState<MonsterDanger>(monster?.danger ?? "harmless");
  const [size, setSize] = useState<MonsterSize>(monster?.size ?? "medium");
  const [habitatArticleId, setHabitatArticleId] = useState(monster?.habitatArticleId ?? "");
  const [attributeInputs, setAttributeInputs] = useState(() =>
    toAttributeInputs(monster?.attributes ?? EMPTY_ATTRIBUTES),
  );
  const [proficiency, setProficiency] = useState(String(monster?.proficiencyBonus ?? PROFICIENCY_DEFAULT));
  const [skills, setSkills] = useState<Skill[]>(monster?.skills ?? []);
  const [abilities, setAbilities] = useState<Ability[]>(monster?.abilities ?? []);
  const [traits, setTraits] = useState<Record<TraitKey, string>>({
    personality: monster?.personality ?? "",
    ideals: monster?.ideals ?? "",
    bonds: monster?.bonds ?? "",
    flaws: monster?.flaws ?? "",
  });
  const [bio, setBio] = useState<RichDoc | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(initialError ?? null);
  const pendingImage = usePendingImageUpload();
  const allowOwner = !monster || monster.ownerId === actorId;

  const attributes = fromAttributeInputs(attributeInputs);
  const proficiencyValue = Number(proficiency) || 0;
  const base = `/api/worlds/${worldId}/monsters`;
  const viewPath = (id: string) => contentHref(worldId, "monster", id);
  const editPath = (id: string) => contentHref(worldId, "monster", id, "edit");

  async function run<T>(request: Promise<{ ok: true; data: T } | { ok: false; error: string }>) {
    setError(null);
    setPending(true);
    const result = await request;
    setPending(false);
    if (!result.ok) setError(result.error);
    return result;
  }

  function sheetPayload() {
    const originalHabitat = monster?.habitatArticleId ?? "";
    return {
      name,
      class: className,
      attributes,
      proficiencyBonus: proficiencyValue,
      skills,
      abilities,
      ...traits,
      kind,
      rarity,
      isBoss,
      danger,
      size,
      ...(!monster || habitatArticleId !== originalHabitat
        ? { habitatArticleId: habitatArticleId || null }
        : {}),
      visibility,
      ...(bio ? { bio } : {}),
    };
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const problem = sheetLocalError({ attributes, skills, abilities });
    if (problem) {
      setError(problem);
      return;
    }
    if (monster) {
      const saved = await run(apiRequest(`${base}/${monster.id}`, "PATCH", sheetPayload()));
      if (saved.ok) {
        router.push(viewPath(monster.id));
        router.refresh();
      }
    } else {
      const created = await run(apiRequest<{ monster: { id: string } }>(base, "POST", sheetPayload()));
      if (!created.ok) return;
      const newId = created.data.monster.id;
      if (pendingImage.hasFile) {
        setPending(true);
        const uploaded = await finishCreateWithImage({
          file: pendingImage.file,
          kind: "monster_portrait",
          worldId,
          targetId: newId,
          onFailureHref: `${editPath(newId)}?imageError=1`,
          navigate: router.push,
        });
        setPending(false);
        if (!uploaded) {
          pendingImage.clear();
          router.refresh();
          return;
        }
        pendingImage.clear();
      }
      router.push(viewPath(newId));
      router.refresh();
    }
  }

  async function onDelete() {
    if (!monster) return;
    const confirmed = window.confirm(`Monster „${monster.name}“ löschen? Relationen darauf entfallen.`);
    if (!confirmed) return;
    const deleted = await run(apiRequest(`${base}/${monster.id}`, "DELETE"));
    if (deleted.ok) {
      router.push(worldPath(worldId));
      router.refresh();
    }
  }

  return (
    <form className="stack" onSubmit={onSubmit}>
      <Link className="back" href={monster ? viewPath(monster.id) : worldPath(worldId)}>
        ‹ {monster ? "Zurück" : "Abbrechen"}
      </Link>
      <h1 style={{ fontSize: 22, marginBottom: 0 }}>{monster ? "Monster bearbeiten" : "Monster anlegen"}</h1>

      <div className="card stack">
        <div className="row">
          <Avatar
            name={name || monster?.name || "?"}
            image={
              pendingImage.previewUrl
                ? pendingImage.previewUrl
                : monster?.portraitId
                  ? `/api/files/${monster.portraitId}`
                  : null
            }
            size="lg"
          />
          <div className="stack grow" style={{ gap: 6 }}>
            {monster ? (
              <ImageUploadField
                mode="immediate"
                disabled={pending}
                upload={{ kind: "monster_portrait", worldId, targetId: monster.id }}
                onUploaded={() => router.refresh()}
                onError={setError}
                onRemove={monster.portraitId ? async () => {
                  const result = await apiRequest(`${base}/${monster.id}`, "PATCH", { removePortrait: true });
                  return result.ok ? { ok: true } : { ok: false, error: result.error };
                } : undefined}
              />
            ) : (
              <ImageUploadField
                mode="pending"
                disabled={pending}
                onFileChange={pendingImage.chooseFile}
                onRemove={pendingImage.hasFile ? pendingImage.clear : undefined}
              />
            )}
            <p className="small muted" style={{ margin: 0 }}>
              Genau ein Bild. Ohne Bild: Initialen-Platzhalter.
            </p>
          </div>
        </div>
        <label className="stack" style={{ gap: 6 }}>
          <span className="field-label">Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={CHARACTER_NAME_MAX} required />
        </label>
        <div className="grid2">
          <label className="stack" style={{ gap: 6 }}>
            <span className="field-label">Klasse (Freitext)</span>
            <input value={className} onChange={(e) => setClassName(e.target.value)} maxLength={CHARACTER_CLASS_MAX} />
          </label>
          <ContentVisibilitySelect value={visibility} onChange={setVisibility} allowOwner={allowOwner} />
        </div>
      </div>

      <div className="grid2">
        <label className="stack" style={{ gap: 6 }}>
          <span className="field-label">Art</span>
          <select value={kind} onChange={(e) => setKind(e.target.value as MonsterKind)}>
            {MONSTER_KINDS.map((entry) => (
              <option key={entry} value={entry}>
                {MONSTER_KIND_LABEL[entry]}
              </option>
            ))}
          </select>
        </label>
        <label className="stack" style={{ gap: 6 }}>
          <span className="field-label">Seltenheit</span>
          <select value={rarity} onChange={(e) => setRarity(e.target.value as MonsterRarity)}>
            {MONSTER_RARITIES.map((entry) => (
              <option key={entry} value={entry}>
                {MONSTER_RARITY_LABEL[entry]}
              </option>
            ))}
          </select>
        </label>
        <label className="stack" style={{ gap: 6 }}>
          <span className="field-label">Gefahrenstufe</span>
          <select value={danger} onChange={(e) => setDanger(e.target.value as MonsterDanger)}>
            {MONSTER_DANGERS.map((entry) => (
              <option key={entry} value={entry}>
                {MONSTER_DANGER_LABEL[entry]}
              </option>
            ))}
          </select>
        </label>
        <label className="stack" style={{ gap: 6 }}>
          <span className="field-label">Größe</span>
          <select value={size} onChange={(e) => setSize(e.target.value as MonsterSize)}>
            {MONSTER_SIZES.map((entry) => (
              <option key={entry} value={entry}>
                {MONSTER_SIZE_LABEL[entry]}
                {entry === "medium" ? " (ca. 1,50 m)" : ""}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="row" style={{ gap: 8, alignItems: "center" }}>
        <input
          type="checkbox"
          checked={isBoss}
          onChange={(e) => setIsBoss(e.target.checked)}
          style={{ width: "auto" }}
        />
        <span>Boss</span>
      </label>

      <label className="stack" style={{ gap: 6 }}>
        <span className="field-label">Lebensraum (Ort)</span>
        <select value={habitatArticleId} onChange={(e) => setHabitatArticleId(e.target.value)}>
          <option value="">— keiner —</option>
          {currentHabitat && !placeOptions.some((place) => place.id === currentHabitat.id) ? (
            <option value={currentHabitat.id} disabled>
              {currentHabitat.title} (kein Ort mehr)
            </option>
          ) : null}
          {placeOptions.map((place) => (
            <option key={place.id} value={place.id}>
              {place.title}
            </option>
          ))}
        </select>
      </label>

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
        bioInitial={asRichDoc(monster?.bioJson ?? null)}
        onBioChange={setBio}
        bioAriaLabel="Bio des Monsters"
        mentions={{ worldId, canCreateArticle: true, states: mentionStates }}
      />
      <p className="small muted" style={{ marginTop: -8 }}>
        Tippe @ für Erwähnungen. Monster sind nicht als Stub anlegbar.
      </p>

      {error ? (
        <p className="error-text" role="alert">
          {error}
        </p>
      ) : null}
      <div className="row">
        <button type="submit" className="btn primary grow" disabled={pending || !name.trim()}>
          Speichern
        </button>
        {monster ? (
          <button type="button" className="btn danger" disabled={pending} onClick={onDelete}>
            Löschen
          </button>
        ) : null}
      </div>
    </form>
  );
}
