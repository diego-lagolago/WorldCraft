import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { loadSpikeState } from "@/spike/karte/repository";
import { KarteSpikePage } from "@/spike/karte/KarteSpikePage";

export const dynamic = "force-dynamic";

export default async function SpikeKarteRoute({
  searchParams,
}: {
  searchParams: Promise<{ pin?: string }>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    redirect("/");
  }
  const { pin } = await searchParams;
  const initialState = await loadSpikeState();
  return <KarteSpikePage highlightPinId={pin} initialState={initialState} />;
}
