import Link from "next/link";
import { redirect } from "next/navigation";
import { worldPath } from "@/components/shell/nav";
import { JoinInviteButton } from "@/components/world/JoinInviteButton";
import { getInvitePreview } from "@/lib/domain/invites";
import { safeNextPath } from "@/lib/next-path";
import { getOptionalSession } from "@/lib/session";

export const dynamic = "force-dynamic";

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <main className="center">
      <div className="login stack text-center">
        <div className="logo" aria-hidden="true">
          ✉️
        </div>
        <h1>Einladung</h1>
        {children}
      </div>
    </main>
  );
}

export default async function InvitePage({ params }: PageProps<"/invite/[code]">) {
  const { code } = await params;
  const session = await getOptionalSession();
  if (!session?.user) {
    const next = safeNextPath(`/invite/${code}`);
    redirect(next ? `/?next=${encodeURIComponent(next)}` : "/");
  }

  const preview = await getInvitePreview(code, session.user.id);
  if (!preview) {
    return (
      <Frame>
        <p>Diese Einladung gibt es nicht.</p>
        <Link className="btn" href="/">
          Zur Startseite
        </Link>
      </Frame>
    );
  }

  if (preview.membership === "active") {
    return (
      <Frame>
        <p>
          Du bist bereits Mitglied in <b>{preview.worldName}</b>.
        </p>
        <Link className="btn primary" href={worldPath(preview.worldId)}>
          Zur Welt
        </Link>
      </Frame>
    );
  }

  if (preview.status !== "valid") {
    return (
      <Frame>
        <p>
          Die Einladung in <b>{preview.worldName}</b> ist{" "}
          {preview.status === "revoked" ? "widerrufen" : "abgelaufen"}.
        </p>
        <p className="muted small">Bitte die Spielleitung um einen neuen Link.</p>
        <Link className="btn" href="/">
          Zur Startseite
        </Link>
      </Frame>
    );
  }

  return (
    <Frame>
      <p>
        Du wurdest in <b>{preview.worldName}</b> eingeladen.
      </p>
      <p className="muted small">
        Du trittst als Player bei.
        {preview.membership === "archived"
          ? " Deine Charaktere kannst du danach wieder mitbringen; ihre Tagebucheinträge sind dann wieder da."
          : null}
      </p>
      <JoinInviteButton code={code} />
      <Link className="btn" href="/">
        Abbrechen
      </Link>
    </Frame>
  );
}
