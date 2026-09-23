"use client";

import Link from "next/link";
import { linkedGroupLabel, type LinkedItem } from "@/lib/map/linked";
import { pinTypeIconUrl, isPinType } from "@/lib/map/pin-types";

const KIND_ORDER = ["pin", "article", "quest", "character", "universe", "monster"] as const;

export function LinkedPanel({ items }: { items: LinkedItem[] }) {
  if (items.length === 0) {
    return (
      <section className="card linked">
        <h2>Verknüpft</h2>
        <p className="empty">Noch keine Verknüpfungen.</p>
      </section>
    );
  }

  const groups = KIND_ORDER.map((kind) => ({
    kind,
    items: items.filter((item) => item.kind === kind),
  })).filter((group) => group.items.length > 0);

  return (
    <section className="card linked">
      <h2>Verknüpft</h2>
      {groups.map((group) => {
        if (group.kind === "article") {
          const byTemplate = new Map<string, LinkedItem[]>();
          for (const item of group.items) {
            const key = item.templateType ?? "none";
            const list = byTemplate.get(key) ?? [];
            list.push(item);
            byTemplate.set(key, list);
          }
          return [...byTemplate.entries()].map(([template, rows]) => (
            <div key={`article-${template}`}>
              <h3>{linkedGroupLabel("article", template)}</h3>
              <div className="list">{rows.map((item) => <LinkedRow key={item.id + (item.manualLabel ?? "")} item={item} />)}</div>
            </div>
          ));
        }
        return (
          <div key={group.kind}>
            <h3>{linkedGroupLabel(group.kind)}</h3>
            <div className="list">{group.items.map((item) => <LinkedRow key={item.id + (item.manualLabel ?? "")} item={item} />)}</div>
          </div>
        );
      })}
    </section>
  );
}

function LinkedRow({ item }: { item: LinkedItem }) {
  return (
    <Link className="item" href={item.href}>
      {item.kind === "pin" && item.pinType && isPinType(item.pinType) ? (
        <img src={pinTypeIconUrl(item.pinType)} width={26} height={31} alt="" />
      ) : null}
      {item.kind === "character" || item.kind === "monster" ? (
        <span className="av">{item.title.slice(0, 1)}</span>
      ) : null}
      <div className="grow">
        <div>{item.title}</div>
        {item.manualLabel ? (
          <div className="rel-label">{item.manualLabel}</div>
        ) : (
          <div className="origin">{item.originLabels.join(" · ")}</div>
        )}
      </div>
      {item.mapName ? <span className="kind">{item.mapName}</span> : null}
    </Link>
  );
}
