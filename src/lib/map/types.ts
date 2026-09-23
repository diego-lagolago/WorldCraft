import type { ContentVisibility, MembershipRole, VisibilityStatus } from "@/lib/authz";
import type { ResolvedMention } from "@/lib/domain/mention-resolve";
import type { RichDoc } from "@/lib/editor/rich-text";
import type { LinkedItem } from "./linked";
import type { PinType } from "./pin-types";

export type MapUniverseDto = {
  id: string;
  name: string;
  visibility: VisibilityStatus;
};

/** Entry in the map picker; label format is `<Universum>: <Karte>`. */
export type MapOptionDto = {
  id: string;
  universeId: string;
  universeName: string;
  name: string;
  visibility: VisibilityStatus;
  hasImage: boolean;
  /** Preformatted `Universum: Karte` (+ optional · SL). */
  label: string;
};

export type MapDto = {
  id: string;
  universeId: string;
  name: string;
  imageId: string | null;
  imageUrl: string | null;
  imageWidth: number | null;
  imageHeight: number | null;
  visibility: VisibilityStatus;
  updatedAt: string;
};

export type PinDto = {
  id: string;
  mapId: string;
  pinType: PinType;
  title: string;
  descriptionJson: RichDoc | null;
  descriptionPlain: string | null;
  posX: number;
  posY: number;
  visibility: ContentVisibility;
  ownerId?: string;
  locked: boolean;
};

export type MarkerDto = {
  id: string;
  mapId: string;
  characterId: string;
  name: string;
  portraitId: string | null;
  ownerId: string;
  posX: number;
  posY: number;
};

export type PlaceableCharacterDto = {
  id: string;
  name: string;
  portraitId: string | null;
  ownerId: string;
  ownerName: string;
  /** Marker already on the currently selected map. */
  placed: boolean;
  /** Marker exists on a different map (placing moves it). */
  placedElsewhere: boolean;
};

export type MapState = {
  actorId: string;
  role: MembershipRole;
  staff: boolean;
  universes: MapUniverseDto[];
  maps: MapOptionDto[];
  universe: MapUniverseDto | null;
  map: MapDto | null;
  mapHidden: boolean;
  pins: PinDto[];
  markers: MarkerDto[];
  characters: PlaceableCharacterDto[];
  highlightPinId: string | null;
};

export type PinDetails = PinDto & {
  linked: LinkedItem[];
  mentions: Record<string, ResolvedMention>;
};
