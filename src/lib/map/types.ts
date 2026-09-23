import type { MembershipRole, VisibilityStatus } from "@/lib/authz";
import type { ResolvedMention } from "@/lib/domain/mention-resolve";
import type { RichDoc } from "@/lib/editor/rich-text";
import type { LinkedItem } from "./linked";
import type { PinType } from "./pin-types";

export type MapUniverseDto = {
  id: string;
  name: string;
  visibility: VisibilityStatus;
};

export type MapDto = {
  id: string;
  universeId: string;
  name: string;
  imageId: string;
  imageUrl: string;
  imageWidth: number;
  imageHeight: number;
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
  visibility: VisibilityStatus;
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
  placed: boolean;
};

export type MapState = {
  actorId: string;
  role: MembershipRole;
  staff: boolean;
  universes: MapUniverseDto[];
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
