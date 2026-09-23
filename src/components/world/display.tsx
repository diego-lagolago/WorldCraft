import type { ContentVisibility, VisibilityStatus } from "@/lib/authz/types";

/** Staff see badges for non-published content they can view. */
export function GmBadge({ visibility }: { visibility: VisibilityStatus | ContentVisibility }) {
  if (visibility === "owner_only") return <span className="badge owner">nur ich</span>;
  return visibility === "gm_only" ? <span className="badge gm">nur Spielleitung</span> : null;
}

function hue(value: string): number {
  let h = 0;
  for (const char of value) h = (h * 31 + char.charCodeAt(0)) % 360;
  return h;
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function Avatar({ name, image, size }: { name: string; image?: string | null; size?: "sm" | "lg" }) {
  const className = size ? `av ${size}` : "av";
  if (image) {
    // eslint-disable-next-line @next/next/no-img-element -- avatars come from Discord or /api/files
    return <img className={className} src={image} alt="" style={{ objectFit: "cover" }} />;
  }
  return (
    <span className={className} style={{ background: `hsl(${hue(name)} 60% 68%)` }} aria-hidden="true">
      {initials(name)}
    </span>
  );
}

export function Hero({ title, imageId }: { title: string; imageId?: string | null }) {
  return (
    <div className="hero">
      {imageId ? (
        // eslint-disable-next-line @next/next/no-img-element -- served by /api/files with auth
        <img className="hero-image" src={`/api/files/${imageId}`} alt="" />
      ) : null}
      <h1>{title}</h1>
    </div>
  );
}
