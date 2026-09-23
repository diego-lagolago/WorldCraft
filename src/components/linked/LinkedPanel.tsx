import Link from "next/link";
import { groupLinkedItems, type LinkedItem } from "@/lib/domain/linked";

export function LinkedPanel({ items }: { items: LinkedItem[] }) {
  if (items.length === 0) {
    return (
      <section className="card linked">
        <h2>Verknüpft</h2>
        <p className="empty">Noch keine Verknüpfungen.</p>
      </section>
    );
  }

  return (
    <section className="card linked">
      <h2>Verknüpft</h2>
      {groupLinkedItems(items).map((group) => (
        <div key={group.label}>
          <h3>{group.label}</h3>
          <div className="list">
            {group.items.map((item) => (
              <LinkedRow key={`${item.kind}:${item.id}:${item.manualLabel ?? ""}`} item={item} />
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}

function LinkedRow({ item }: { item: LinkedItem }) {
  return (
    <Link className="item" href={item.href}>
      {item.kind === "pin" ? (
        <span aria-hidden="true">📍</span>
      ) : item.kind === "character" || item.kind === "monster" ? (
        item.portraitId ? (
          <img className="av" src={`/api/files/${item.portraitId}`} alt="" />
        ) : (
          <span className="av">{item.title.slice(0, 1)}</span>
        )
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
