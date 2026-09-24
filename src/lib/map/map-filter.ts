import { PIN_TYPE_META, type PinType } from "./pin-types";

/** Filter categories: character/monster groups + one chip per pin type (Plan 006 T-007). */
export type MapFilterCategory = "characters" | "monsters" | `pin:${PinType}`;

export type MapFilterItem =
  | { kind: "character" }
  | { kind: "monster" }
  | { kind: "pin"; pinType: PinType; highlighted?: boolean };

export type MapFilterCategoryInfo = {
  key: MapFilterCategory;
  label: string;
  icon: string;
  pinType?: PinType;
};

export const MAP_FILTER_CATS: ReadonlyArray<MapFilterCategoryInfo> = [
  { key: "characters", label: "Charaktere", icon: "🧝" },
  { key: "monsters", label: "Monster", icon: "👹" },
  ...PIN_TYPE_META.map((meta) => ({
    key: `pin:${meta.id}` as MapFilterCategory,
    label: meta.label,
    icon: meta.label,
    pinType: meta.id,
  })),
];

export function categoryForItem(item: MapFilterItem): MapFilterCategory {
  if (item.kind === "character") return "characters";
  if (item.kind === "monster") return "monsters";
  return `pin:${item.pinType}`;
}

/** Highlighted deep-link pins stay visible even when their type is filtered off (T-007). */
export function isMapFilterVisible(
  item: MapFilterItem,
  hidden: readonly MapFilterCategory[],
): boolean {
  if (item.kind === "pin" && item.highlighted) return true;
  return !hidden.includes(categoryForItem(item));
}

export function toggleMapFilterHidden(
  hidden: readonly MapFilterCategory[],
  category: MapFilterCategory,
): MapFilterCategory[] {
  return hidden.includes(category)
    ? hidden.filter((row) => row !== category)
    : [...hidden, category];
}
