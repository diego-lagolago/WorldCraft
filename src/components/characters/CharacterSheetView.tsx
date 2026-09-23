import type { ReactNode } from "react";
import { RichTextView } from "@/components/editor/RichTextView";
import { Avatar } from "@/components/world/display";
import {
  ATTRIBUTE_KEYS,
  ATTRIBUTE_SHORT,
  CHARACTER_IMAGES_MAX,
  SKILL_LEVEL_LABEL,
  attributeModifier,
  formatSigned,
  skillBonus,
} from "@/lib/characters/sheet";
import type { CharacterSheet } from "@/lib/domain/characters";
import { asRichDoc } from "@/lib/editor/rich-text";
import "./characters.css";

export function portraitUrl(portraitId: string | null): string | null {
  return portraitId ? `/api/files/${portraitId}` : null;
}

const TRAITS = [
  ["personality", "Persönlichkeit"],
  ["ideals", "Ideale"],
  ["bonds", "Bindungen"],
  ["flaws", "Makel"],
] as const;

/** Fachmodell 3.8 layout: attributes, skills, abilities, traits, bio; images on the right. */
export function CharacterSheetView({ sheet, actions }: { sheet: CharacterSheet; actions?: ReactNode }) {
  return (
    <>
      <div className="row" style={{ marginBottom: 14 }}>
        <Avatar name={sheet.name} image={portraitUrl(sheet.portraitId)} size="lg" />
        <div className="grow">
          <h1 style={{ fontSize: 24 }}>{sheet.name}</h1>
          <div className="muted">
            {[sheet.class, `gespielt von ${sheet.ownerName}`].filter(Boolean).join(" · ")}
          </div>
        </div>
        {actions}
      </div>
      <div className="grid2">
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
            <RichTextView doc={asRichDoc(sheet.bioJson)} empty={<p className="muted">Noch keine Bio.</p>} />
          </div>
        </div>
        <div className="stack">
          <div className="card">
            <h2>
              Bilder ({sheet.images.length}/{CHARACTER_IMAGES_MAX})
            </h2>
            {sheet.images.length === 0 ? <span className="muted small">Keine Bilder.</span> : null}
            <div className="thumbs">
              {sheet.images.map((image) => (
                <figure key={image.id} className="thumb">
                  <a href={`/api/files/${image.fileId}`} target="_blank" rel="noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element -- served by /api/files */}
                    <img src={`/api/files/${image.fileId}`} alt={image.caption ?? ""} />
                  </a>
                  {image.caption ? <figcaption>{image.caption}</figcaption> : null}
                </figure>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
