import { AppShell } from "@/components/shell/AppShell";
import { requirePageUser } from "@/lib/page-context";

export const dynamic = "force-dynamic";

export default async function McpHelpLayout({ children }: LayoutProps<"/hilfe/mcp">) {
  await requirePageUser();
  return <AppShell world={null}>{children}</AppShell>;
}
