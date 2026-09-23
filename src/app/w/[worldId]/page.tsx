import { requireWorldPage } from "@/lib/page-context";

export default async function CampaignHubPage({ params }: PageProps<"/w/[worldId]">) {
  const { worldId } = await params;
  const { world } = await requireWorldPage(worldId);
  return (
    <>
      <div className="hero">
        <h1>{world.name}</h1>
      </div>
      <p className="muted">Universen, Artikel und Quests dieser Welt erscheinen hier.</p>
    </>
  );
}
