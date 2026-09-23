import { SignOutButton } from "@/components/shell/SignOutButton";
import { requireWorldPage } from "@/lib/page-context";

export default async function WorldMenuPage({ params }: PageProps<"/w/[worldId]">) {
  const { worldId } = await params;
  const { user } = await requireWorldPage(worldId);
  return (
    <div className="stack">
      <h1 className="text-xl font-semibold">Menü</h1>
      <div className="card stack">
        <p className="muted small">Angemeldet als {user.name}</p>
        <SignOutButton />
      </div>
    </div>
  );
}
