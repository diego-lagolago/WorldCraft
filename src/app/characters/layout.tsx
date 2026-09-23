import { AppShell } from "@/components/shell/AppShell";
import { requirePageUser } from "@/lib/page-context";

export const dynamic = "force-dynamic";

export default async function CharactersLayout({ children }: LayoutProps<"/characters">) {
  await requirePageUser();
  return <AppShell world={null}>{children}</AppShell>;
}
