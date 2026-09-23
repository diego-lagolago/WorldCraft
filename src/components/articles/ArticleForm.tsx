"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ChangeEvent, type FormEvent } from "react";
import { RichTextEditor } from "@/components/editor/RichTextEditor";
import { worldPath } from "@/components/shell/nav";
import { IMAGE_ACCEPT } from "@/components/world/image-accept";
import { ContentVisibilitySelect } from "@/components/world/VisibilitySelect";
import type { ContentVisibility } from "@/lib/authz/types";
import { apiRequest, uploadImage } from "@/lib/client/api";
import { usePendingImageUpload } from "@/lib/client/usePendingImageUpload";
import type { ArticleRefOption } from "@/lib/domain/articles";
import type { MentionState } from "@/lib/editor/mentions";
import type { RichDoc } from "@/lib/editor/rich-text";
import type { StoredTemplateFields } from "@/lib/templates/fields";
import { TEMPLATES, TEMPLATE_TYPES, templateOf, type TemplateType } from "@/lib/templates/registry";

type Article = {
  id: string;
  title: string;
  templateType: string;
  visibility: ContentVisibility;
  ownerId: string;
  titleImageId: string | null;
  body: RichDoc | null;
  templateFields: StoredTemplateFields;
};

function encodeRef(value: { kind: string; id: string } | undefined): string {
  if (!value || typeof value === "string") return "";
  return `${value.kind}:${value.id}`;
}

function decodeRef(value: string): { kind: "article" | "character"; id: string } | "" {
  const [kind, id] = value.split(":");
  if ((kind === "article" || kind === "character") && id) return { kind, id };
  return "";
}

function fieldsForForm(type: TemplateType, stored: StoredTemplateFields): Record<string, string> {
  const out: Record<string, string> = {};
  for (const field of templateOf(type).fields) {
    const value = stored[field.key];
    if (value === undefined) out[field.key] = "";
    else if (typeof value === "string") out[field.key] = value;
    else out[field.key] = encodeRef(value);
  }
  return out;
}

function payloadFields(type: TemplateType, fields: Record<string, string>) {
  const out: Record<string, unknown> = {};
  for (const field of templateOf(type).fields) {
    const value = fields[field.key] ?? "";
    if (!value) continue;
    out[field.key] = field.type === "ref" ? decodeRef(value) || undefined : value;
  }
  return out;
}

export function ArticleForm({
  worldId,
  article,
  actorId,
  refOptions,
  mentionStates,
  initialError,
}: {
  worldId: string;
  article?: Article;
  /** Current user — needed so R2 can hide „nur ich“ on foreign records. */
  actorId: string;
  refOptions: ArticleRefOption[];
  mentionStates?: Record<string, MentionState>;
  /** Shown once after create+upload failure (edit page). */
  initialError?: string;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(article?.title ?? "");
  const [templateType, setTemplateType] = useState<TemplateType>(
    templateOf(article?.templateType ?? "none").type,
  );
  const [visibility, setVisibility] = useState<ContentVisibility>(article?.visibility ?? "owner_only");
  const [fields, setFields] = useState(() =>
    fieldsForForm(templateOf(article?.templateType ?? "none").type, article?.templateFields ?? {}),
  );
  const [body, setBody] = useState<RichDoc | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(initialError ?? null);
  const pendingImage = usePendingImageUpload();
  const allowOwner = !article || article.ownerId === actorId;

  const base = `/api/worlds/${worldId}/articles`;
  const viewPath = (id: string) => worldPath(worldId, `/articles/${id}`);
  const editPath = (id: string) => worldPath(worldId, `/articles/${id}/edit`);
  const template = templateOf(templateType);

  async function run<T>(request: Promise<{ ok: true; data: T } | { ok: false; error: string }>) {
    setError(null);
    setPending(true);
    const result = await request;
    setPending(false);
    if (!result.ok) setError(result.error);
    return result;
  }

  function onTemplateChange(next: TemplateType) {
    if (next === templateType) return;
    if (Object.values(fields).some(Boolean)) {
      const confirmed = window.confirm("Felder der bisherigen Vorlage werden verworfen. Vorlage wechseln?");
      if (!confirmed) return;
    }
    setTemplateType(next);
    setFields(fieldsForForm(next, {}));
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const payload = {
      title,
      templateType,
      templateFields: payloadFields(templateType, fields),
      visibility,
      ...(body ? { body } : {}),
    };
    if (article) {
      const saved = await run(apiRequest(`${base}/${article.id}`, "PATCH", payload));
      if (saved.ok) {
        router.push(viewPath(article.id));
        router.refresh();
      }
    } else {
      const created = await run(apiRequest<{ article: { id: string } }>(base, "POST", payload));
      if (!created.ok) return;
      const newId = created.data.article.id;
      if (pendingImage.hasFile) {
        setPending(true);
        const uploaded = await pendingImage.uploadAfterCreate({
          kind: "article_title",
          worldId,
          targetId: newId,
        });
        setPending(false);
        if (!uploaded || !uploaded.ok) {
          pendingImage.clear();
          router.push(`${editPath(newId)}?titleImageError=1`);
          router.refresh();
          return;
        }
        pendingImage.clear();
      }
      router.push(viewPath(newId));
      router.refresh();
    }
  }

  async function onImage(event: ChangeEvent<HTMLInputElement>) {
    if (!article) {
      pendingImage.choose(event);
      return;
    }
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const result = await run(uploadImage({ file, kind: "article_title", worldId, targetId: article.id }));
    if (result.ok) router.refresh();
  }

  async function onRemoveImage() {
    if (!article) {
      pendingImage.clear();
      return;
    }
    const result = await run(apiRequest(`${base}/${article.id}`, "PATCH", { removeTitleImage: true }));
    if (result.ok) router.refresh();
  }

  async function onDelete() {
    if (!article) return;
    const confirmed = window.confirm(`Artikel „${article.title}“ löschen? Relationen darauf entfallen.`);
    if (!confirmed) return;
    const deleted = await run(apiRequest(`${base}/${article.id}`, "DELETE"));
    if (deleted.ok) {
      router.push(worldPath(worldId));
      router.refresh();
    }
  }

  return (
    <form className="stack" onSubmit={onSubmit}>
      <Link className="back" href={article ? viewPath(article.id) : worldPath(worldId)}>
        ‹ Abbrechen
      </Link>
      <input
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        placeholder="Titel"
        aria-label="Titel"
        maxLength={200}
        required
        style={{ fontSize: 20, fontWeight: 700 }}
      />
      <div className="grid2">
        <label className="stack" style={{ gap: 6 }}>
          <span className="field-label">Vorlage</span>
          <select value={templateType} onChange={(event) => onTemplateChange(event.target.value as TemplateType)}>
            {TEMPLATE_TYPES.map((type) => (
              <option key={type} value={type}>
                {TEMPLATES[type].label}
              </option>
            ))}
          </select>
        </label>
        <ContentVisibilitySelect value={visibility} onChange={setVisibility} allowOwner={allowOwner} />
      </div>

      <div className="card stack" style={{ gap: 8 }}>
        <div className="row">
          <span className="grow">Titelbild</span>
          <label className="btn sm">
            Bild wählen
            <input type="file" accept={IMAGE_ACCEPT} hidden onChange={onImage} disabled={pending} />
          </label>
          {article?.titleImageId || pendingImage.hasFile ? (
            <button type="button" className="btn sm" onClick={onRemoveImage} disabled={pending}>
              Entfernen
            </button>
          ) : null}
        </div>
        {pendingImage.previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- local blob preview
          <img
            src={pendingImage.previewUrl}
            alt="Vorschau Titelbild"
            style={{ maxWidth: "100%", maxHeight: 160, objectFit: "cover", borderRadius: 10 }}
          />
        ) : null}
      </div>

      {template.fields.length > 0 ? (
        <div className="card stack">
          <h2 style={{ margin: 0 }}>{template.label}</h2>
          {template.fields.map((field) => (
            <label key={field.key} className="stack" style={{ gap: 6 }}>
              <span className="field-label">{field.label}</span>
              {field.type === "select" ? (
                <select
                  value={fields[field.key] ?? ""}
                  onChange={(event) => setFields((current) => ({ ...current, [field.key]: event.target.value }))}
                >
                  <option value="">–</option>
                  {field.options.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              ) : field.type === "ref" ? (
                <select
                  value={fields[field.key] ?? ""}
                  onChange={(event) => setFields((current) => ({ ...current, [field.key]: event.target.value }))}
                >
                  <option value="">–</option>
                  {refOptions
                    .filter((option) => {
                      if (article && option.kind === "article" && option.id === article.id) return false;
                      if (option.kind === "character") return field.targets.some((target) => target.kind === "character");
                      return field.targets.some(
                        (target) => target.kind === "article" && target.templateType === option.templateType,
                      );
                    })
                    .map((option) => (
                      <option key={`${option.kind}:${option.id}`} value={`${option.kind}:${option.id}`}>
                        {option.title}
                        {option.kind === "character" ? " (Charakter)" : ""}
                      </option>
                    ))}
                </select>
              ) : (
                <input
                  value={fields[field.key] ?? ""}
                  onChange={(event) => setFields((current) => ({ ...current, [field.key]: event.target.value }))}
                  maxLength={200}
                />
              )}
            </label>
          ))}
        </div>
      ) : null}

      <div className="stack" style={{ gap: 6 }}>
        <span className="field-label">Inhalt</span>
        <RichTextEditor
          initialContent={article?.body ?? null}
          onChange={({ doc }) => setBody(doc)}
          mentions={{ worldId, canCreateArticle: true, states: mentionStates }}
          ariaLabel="Inhalt des Artikels"
        />
        <p className="small muted">Tippe @ für Erwähnungen. Bilder und Tabellen werden beim Einfügen verworfen.</p>
      </div>

      {error ? (
        <p className="error-text" role="alert">
          {error}
        </p>
      ) : null}
      <div className="row">
        <button type="submit" className="btn primary grow" disabled={pending || !title.trim()}>
          Speichern
        </button>
        {article ? (
          <button type="button" className="btn danger" disabled={pending} onClick={onDelete}>
            Löschen
          </button>
        ) : null}
      </div>
    </form>
  );
}
