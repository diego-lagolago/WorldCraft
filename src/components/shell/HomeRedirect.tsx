"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { pickLastWorld, readLastWorld } from "@/lib/client/last-context";
import { worldPath } from "./nav";

type Props = {
  worldIds: string[];
  /** Onboarding, shown when no valid last world is stored on this device. */
  children: ReactNode;
};

/** `/` for signed-in users: redirect to the last world, else onboarding. */
export function HomeRedirect({ worldIds, children }: Props) {
  const router = useRouter();
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    const target = pickLastWorld(readLastWorld(), worldIds);
    if (target) {
      router.replace(worldPath(target));
    } else {
      // localStorage exists only after mount.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setShowOnboarding(true);
    }
  }, [router, worldIds]);

  if (!showOnboarding) {
    return (
      <main className="center">
        <p className="muted">Welt wird geladen …</p>
      </main>
    );
  }
  return <>{children}</>;
}
