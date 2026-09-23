import type { ReactNode } from "react";
import { SheetBodyView } from "@/components/sheet/SheetBodyView";
import { Avatar } from "@/components/world/display";
import { CHARACTER_IMAGES_MAX } from "@/lib/characters/sheet";
import type { CharacterSheet } from "@/lib/domain/characters";
import "@/components/sheet/sheet.css";
import "./characters.css";

export function portraitUrl(portraitId: string | null): string | null {
  return portraitId ? `/api/files/${portraitId}` : null;
}

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
        <SheetBodyView sheet={sheet} />
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
