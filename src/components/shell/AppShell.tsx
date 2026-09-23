"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { readLastWorld, rememberWorld } from "@/lib/client/last-context";
import { NAV_TABS, activeNavTab, isChatFocus, worldPath } from "./nav";

type Props = {
  /** Null on world-independent pages (`/characters`): links use the last world. */
  world: { id: string; name: string } | null;
  /** Full-bleed pages (chat, map) render without the padded content column. */
  children: ReactNode;
};

export function AppShell({ world, children }: Props) {
  const pathname = usePathname();
  const [fallbackWorldId, setFallbackWorldId] = useState<string | null>(null);

  useEffect(() => {
    if (world) {
      rememberWorld(world.id);
    } else {
      // localStorage exists only after mount.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFallbackWorldId(readLastWorld());
    }
  }, [world]);

  const worldId = world?.id ?? fallbackWorldId;
  const active = activeNavTab(pathname);
  const chatFocus = isChatFocus(pathname);
  const full = chatFocus || active === "map";

  return (
    <div className={chatFocus ? "shell chat-focus" : "shell"}>
      <nav className="nav" aria-label="Hauptnavigation">
        <div className="brand">WORLDCRAFT</div>
        {NAV_TABS.map((tab) => {
          const href =
            tab.id === "menu" && !worldId ? "/characters" : worldId ? worldPath(worldId, tab.path) : "/";
          const on = active === tab.id;
          return (
            <Link key={tab.id} href={href} className={on ? "on" : undefined} aria-current={on ? "page" : undefined}>
              <span className="ic" aria-hidden="true">
                {tab.icon}
              </span>
              <span>{tab.label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="main">
        <header className="topbar">
          {world ? (
            <Link href={worldPath(world.id)} className="world">
              {world.name}
            </Link>
          ) : (
            <Link href="/" className="world">
              WorldCraft
            </Link>
          )}
        </header>
        {full ? children : <div className="content">{children}</div>}
      </div>
    </div>
  );
}
