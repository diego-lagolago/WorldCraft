import { AppShell } from "@/components/shell/AppShell";
import { requireWorldPage } from "@/lib/page-context";

export const dynamic = "force-dynamic";

export default async function WorldLayout({ children, params }: LayoutProps<"/w/[worldId]">) {
  const { worldId } = await params;
  const { world } = await requireWorldPage(worldId);
  return <AppShell world={{ id: world.id, name: world.name }}>{children}</AppShell>;
}
