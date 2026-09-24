"use client";

import { Eye, EyeOff, ImageUp, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { ImageUploadField } from "@/components/files/ImageUploadField";
import { CONTENT_VISIBILITY_LABEL } from "@/lib/authz/types";
import { rememberUniverse } from "@/lib/client/last-context";
import type { MapDto, MapState, MarkerDto, MonsterMarkerDto, PinDetails } from "@/lib/map/types";
import { useMapRealtime } from "./use-map-realtime";
import { useLeafletMap } from "./use-leaflet-map";
import { useMapState } from "./use-map-state";
import {
  CreateMapSheet,
  MapFilterSheet,
  MarkerSheet,
  MonsterMarkerSheet,
  PinFormSheet,
  PinViewSheet,
  PlaceCharacterSheet,
  PlaceMonsterSheet,
  ReplaceImageDialog,
} from "./MapSheets";
import { useMapFilter } from "./use-map-filter";
import { useMapHotkeys } from "./use-map-hotkeys";
import { isMapFilterVisible, type MapFilterCategory } from "@/lib/map/map-filter";

type PlaceMode = "none" | "pin" | "monster" | "copy";

type Sheet =
  | { kind: "none" }
  | { kind: "view"; pin: PinDetails }
  | { kind: "create"; posX: number; posY: number }
  | { kind: "edit"; pin: PinDetails }
  | { kind: "marker"; marker: MarkerDto }
  | { kind: "monster-marker"; marker: MonsterMarkerDto }
  | { kind: "monster-pick"; posX: number; posY: number }
  | { kind: "place" }
  | { kind: "filter" }
  | { kind: "create-map" };

function mapHasImage(map: MapDto | null): map is MapDto & {
  imageId: string;
  imageUrl: string;
  imageWidth: number;
  imageHeight: number;
} {
  return Boolean(map?.imageId && map.imageUrl && map.imageWidth && map.imageHeight);
}

export function MapView({ worldId, initial }: { worldId: string; initial: MapState }) {
  const stream = useMapState(worldId, initial);
  const state = stream.state;
  const filter = useMapFilter(worldId);
  const [placeMode, setPlaceMode] = useState<PlaceMode>("none");
  const [sheet, setSheet] = useState<Sheet>({ kind: "none" });
  const [replaceConfirm, setReplaceConfirm] = useState(false);
  const [copySource, setCopySource] = useState<MonsterMarkerDto | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const placing = placeMode !== "none";

  const setMode = useCallback((next: PlaceMode | ((current: PlaceMode) => PlaceMode)) => {
    setPlaceMode((current) => {
      const resolved = typeof next === "function" ? next(current) : next;
      if (resolved !== "copy") {
        queueMicrotask(() => setCopySource(null));
      }
      return resolved;
    });
  }, []);

  useEffect(() => {
    if (state.universe) rememberUniverse(worldId, state.universe.id);
  }, [worldId, state.universe]);

  // K12: changing maps ends place/copy mode.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset tool mode when the selected map changes
    setMode("none");
  }, [state.map?.id, setMode]);

  const onResync = useCallback(() => {
    stream.onResync();
  }, [stream]);

  const leafletMap = mapHasImage(state.map) ? state.map : null;

  const visiblePins = state.pins.filter((pin) =>
    isMapFilterVisible(
      {
        kind: "pin",
        pinType: pin.pinType,
        highlighted: state.highlightPinId === pin.id,
      },
      filter.hidden,
    ),
  );
  const visibleMarkers = state.markers.filter(() =>
    isMapFilterVisible({ kind: "character" }, filter.hidden),
  );
  const visibleMonsterMarkers = (state.monsterMarkers ?? []).filter(() =>
    isMapFilterVisible({ kind: "monster" }, filter.hidden),
  );

  const leaflet = useLeafletMap(
    containerRef,
    leafletMap,
    visiblePins,
    visibleMarkers,
    visibleMonsterMarkers,
    {
      placing,
      staff: state.staff,
      actorId: state.actorId,
      highlightPinId: state.highlightPinId,
      onMapClick: (x, y) => {
        const mode = placeMode;
        if (mode === "copy" && copySource) {
          void stream.copyMonsterMarker(copySource.id, x, y);
          return;
        }
        setMode("none");
        if (mode === "monster") {
          setSheet({ kind: "monster-pick", posX: x, posY: y });
          return;
        }
        setSheet({ kind: "create", posX: x, posY: y });
      },
      onPinClick: (pin) => {
        void stream.loadPin(pin.id).then((details) => {
          if (details) setSheet({ kind: "view", pin: details });
        });
      },
      onMarkerClick: (marker) => setSheet({ kind: "marker", marker }),
      onMonsterMarkerClick: (marker) => {
        if (placeMode === "copy" && copySource) {
          void stream.copyMonsterMarker(copySource.id, marker.posX, marker.posY);
          return;
        }
        if (placing) return;
        setSheet({ kind: "monster-marker", marker });
      },
      onPinDrop: (pin) => void stream.dropPin(pin),
      onMarkerDrop: (marker) => void stream.dropMarker(marker),
      onMonsterMarkerDrop: (marker) => void stream.dropMonsterMarker(marker),
    },
  );

  useMapRealtime(worldId, state.universe?.id ?? null, (event) => void stream.applyEvent(event, leaflet.dragging), onResync);

  useMapHotkeys({
    enabled: Boolean(leafletMap),
    staff: state.staff,
    sheetOpen: sheet.kind !== "none",
    placeMode,
    setPlaceMode: setMode,
  });

  const mapPublished = state.map?.visibility === "published";
  const selectedOption = state.maps.find((row) => row.id === state.map?.id);
  const selectedLabel = selectedOption?.label ?? (state.map && state.universe ? `${state.universe.name}: ${state.map.name}` : "");

  function startUpload() {
    if (mapHasImage(state.map)) {
      setReplaceConfirm(true);
      return;
    }
    fileInputRef.current?.click();
  }

  function onDeleteMap() {
    if (!state.map) return;
    const confirmed = window.confirm(
      `Karte „${state.map.name}“ mit allen Pins und Markern löschen? Das lässt sich nicht rückgängig machen.`,
    );
    if (!confirmed) return;
    void stream.deleteMap(state.map.id);
  }

  return (
    <div className={placing ? "map-page placing" : "map-page"}>
      <div className="map-top">
        <div className="map-picker">
          {state.maps.length > 0 ? (
            <select
              className="map-select"
              aria-label="Karte wählen"
              value={state.map?.id ?? ""}
              onChange={(event) => {
                const id = event.target.value;
                if (id) void stream.selectMap(id);
              }}
            >
              {state.maps.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          ) : (
            <span className="map-select map-select-empty">{selectedLabel || "Keine Karte"}</span>
          )}
          {state.staff ? (
            <>
              <button
                type="button"
                className="zbtn map-top-btn"
                aria-label="Karte hinzufügen"
                title="Karte hinzufügen"
                onClick={() => setSheet({ kind: "create-map" })}
              >
                <Plus size={18} aria-hidden />
              </button>
              {state.map ? (
                <button
                  type="button"
                  className="zbtn map-top-btn"
                  aria-label="Karte löschen"
                  title="Karte löschen"
                  onClick={onDeleteMap}
                >
                  <Trash2 size={18} aria-hidden />
                </button>
              ) : null}
            </>
          ) : null}
        </div>
        {mapHasImage(state.map) ? (
          <button
            type="button"
            className={filter.hasOff ? "chip map-filter-btn has-off" : "chip map-filter-btn"}
            aria-label="Kartenfilter"
            onClick={() => setSheet({ kind: "filter" })}
          >
            Filter
          </button>
        ) : null}
      </div>

      {state.map ? (
        <ImageUploadField
          mode="immediate"
          hideButton
          inputRef={fileInputRef}
          upload={{ kind: "map", worldId, targetId: state.map.id }}
          onUploaded={() => void stream.reload()}
          onError={(message) => { stream.setError(message); void stream.reload(); }}
        />
      ) : null}

      {replaceConfirm ? (
        <ReplaceImageDialog
          onCancel={() => setReplaceConfirm(false)}
          onConfirm={() => {
            setReplaceConfirm(false);
            fileInputRef.current?.click();
          }}
        />
      ) : null}

      {state.mapHidden ? (
        <div className="map-empty">
          <div className="card">Diese Karte ist nur für die Spielleitung sichtbar.</div>
        </div>
      ) : mapHasImage(state.map) ? (
        <div ref={containerRef} className="map-vp" />
      ) : (
        <div className="map-empty">
          <div className="card stack text-center">
            {state.map ? (
              <>
                <p>Diese Karte hat noch kein Bild.</p>
                {state.staff ? (
                  <button type="button" className="btn primary" onClick={startUpload}>
                    Kartenbild hochladen
                  </button>
                ) : (
                  <p className="muted small">Die Spielleitung kann ein Bild hochladen.</p>
                )}
              </>
            ) : (
              <>
                <p>Für dieses Universum gibt es noch keine Karte.</p>
                {state.staff && state.universes.length > 0 ? (
                  <button type="button" className="btn primary" onClick={() => setSheet({ kind: "create-map" })}>
                    Karte hinzufügen
                  </button>
                ) : null}
              </>
            )}
          </div>
        </div>
      )}

      {state.map ? (
        <div className="map-ctrl">
          {state.staff ? (
            <button
              type="button"
              className="zbtn"
              aria-label="Kartenbild hochladen"
              title={mapHasImage(state.map) ? "Kartenbild ersetzen" : "Kartenbild hochladen"}
              onClick={startUpload}
            >
              <ImageUp size={20} aria-hidden />
            </button>
          ) : null}
          {state.staff ? (
            <button
              type="button"
              className="zbtn"
              aria-label={mapPublished ? "Karte freigegeben" : "Karte versteckt"}
              title={
                mapPublished
                  ? "Karte freigegeben (für alle sichtbar)"
                  : `Karte versteckt (${CONTENT_VISIBILITY_LABEL.gm_only})`
              }
              onClick={() =>
                void stream.setMapVisibility(state.map!.id, mapPublished ? "gm_only" : "published")
              }
            >
              {mapPublished ? <Eye size={20} aria-hidden /> : <EyeOff size={20} aria-hidden />}
            </button>
          ) : null}
          {mapHasImage(state.map) ? (
            <>
              <button type="button" className="zbtn" aria-label="Hineinzoomen" onClick={() => leaflet.zoomBy(1.4)}>
                ＋
              </button>
              <button type="button" className="zbtn" aria-label="Herauszoomen" onClick={() => leaflet.zoomBy(0.7)}>
                －
              </button>
              <button type="button" className="zbtn" aria-label="Ganze Karte" onClick={() => leaflet.fit()}>
                ⤢
              </button>
              <button type="button" className="zbtn" aria-label="Charakter platzieren" onClick={() => setSheet({ kind: "place" })}>
                🧝
              </button>
              {state.staff ? (
                <>
                  <button
                    type="button"
                    className={placeMode === "monster" ? "zbtn on" : "zbtn"}
                    aria-label="Monster platzieren (M)"
                    aria-keyshortcuts="M"
                    title="Monster platzieren (M)"
                    onClick={() => setMode((current) => (current === "monster" ? "none" : "monster"))}
                  >
                    👹
                  </button>
                  <button
                    type="button"
                    className="fab"
                    aria-label={placing ? "Abbrechen" : "Pin setzen (P)"}
                    aria-keyshortcuts="P"
                    title={placing ? "Abbrechen (Esc)" : "Pin setzen (P)"}
                    onClick={() => {
                      if (placing) {
                        setMode("none");
                        return;
                      }
                      setMode("pin");
                    }}
                  >
                    {placing ? "×" : "+"}
                  </button>
                </>
              ) : null}
            </>
          ) : null}
        </div>
      ) : null}

      {placeMode === "pin" ? <p className="map-hint">Tippe auf die Karte, um den Pin zu setzen.</p> : null}
      {placeMode === "monster" ? (
        <p className="map-hint">
          Tippe auf die Karte — danach Monster wählen. Startet als „nur ich“. × / Esc = Abbrechen.
        </p>
      ) : null}
      {placeMode === "copy" && copySource ? (
        <p className="map-hint">
          Tippe, um Kopien von „{copySource.name}“ zu setzen. × / Esc = Abbrechen.
        </p>
      ) : null}

      {stream.error ? <p className="chat-error map-error">{stream.error}</p> : null}

      {sheet.kind === "view" ? (
        <PinViewSheet
          pin={sheet.pin}
          staff={state.staff}
          worldId={worldId}
          onClose={() => setSheet({ kind: "none" })}
          onEdit={() => setSheet({ kind: "edit", pin: sheet.pin })}
          onLock={() => {
            void stream.patchPin(sheet.pin.id, { locked: true }).then((ok) => {
              if (!ok) return;
              return stream.loadPin(sheet.pin.id).then((details) => {
                if (details) setSheet({ kind: "view", pin: details });
              });
            });
          }}
          onUnlock={() => {
            void stream.patchPin(sheet.pin.id, { locked: false }).then((ok) => {
              if (!ok) return;
              return stream.loadPin(sheet.pin.id).then((details) => {
                if (details) setSheet({ kind: "view", pin: details });
              });
            });
          }}
          onDelete={() => {
            void stream.removePin(sheet.pin.id);
            setSheet({ kind: "none" });
          }}
        />
      ) : null}

      {sheet.kind === "create" && state.map ? (
        <PinFormSheet
          title="Neuer Pin"
          worldId={worldId}
          staff={state.staff}
          actorId={state.actorId}
          initial={{ pinType: "city", title: "", description: null, visibility: "owner_only" }}
          onClose={() => setSheet({ kind: "none" })}
          onSave={(value) => {
            void stream
              .createPin({
                mapId: state.map!.id,
                ...value,
                posX: sheet.posX,
                posY: sheet.posY,
              })
              .then(() => setSheet({ kind: "none" }));
          }}
        />
      ) : null}

      {sheet.kind === "edit" ? (
        <PinFormSheet
          title="Pin bearbeiten"
          worldId={worldId}
          staff={state.staff}
          actorId={state.actorId}
          ownerId={sheet.pin.ownerId}
          initial={{
            pinType: sheet.pin.pinType,
            title: sheet.pin.title,
            description: sheet.pin.descriptionJson,
            visibility: sheet.pin.visibility,
          }}
          onClose={() => setSheet({ kind: "none" })}
          onSave={(value) => {
            void stream.patchPin(sheet.pin.id, value);
            setSheet({ kind: "none" });
          }}
        />
      ) : null}

      {sheet.kind === "marker" ? (
        <MarkerSheet
          marker={sheet.marker}
          canEdit={state.staff || state.actorId === sheet.marker.ownerId}
          href={`/w/${worldId}/characters/${sheet.marker.characterId}`}
          onClose={() => setSheet({ kind: "none" })}
          onRemove={() => {
            void stream.removeMarker(sheet.marker.id);
            setSheet({ kind: "none" });
          }}
        />
      ) : null}

      {sheet.kind === "monster-marker" ? (
        <MonsterMarkerSheet
          marker={sheet.marker}
          staff={state.staff}
          actorId={state.actorId}
          href={`/w/${worldId}/monsters/${sheet.marker.monsterId}`}
          onClose={() => setSheet({ kind: "none" })}
          onRemove={() => {
            void stream.removeMonsterMarker(sheet.marker.id);
            setSheet({ kind: "none" });
          }}
          onCopy={() => {
            setCopySource(sheet.marker);
            setPlaceMode("copy");
            setSheet({ kind: "none" });
          }}
          onVisibility={(visibility) => {
            void stream.patchMonsterMarker(sheet.marker.id, { visibility }).then((ok) => {
              if (!ok) return;
              setSheet((current) =>
                current.kind === "monster-marker"
                  ? { ...current, marker: { ...current.marker, visibility } }
                  : current,
              );
            });
          }}
        />
      ) : null}

      {sheet.kind === "monster-pick" && state.map ? (
        <PlaceMonsterSheet
          worldId={worldId}
          onClose={() => setSheet({ kind: "none" })}
          onPick={(monsterId) => {
            const mapId = state.map!.id;
            const { posX, posY } = sheet;
            void stream.placeMonsterMarker(mapId, monsterId, posX, posY).then((ok) => {
              if (ok) setSheet({ kind: "none" });
            });
          }}
        />
      ) : null}

      {sheet.kind === "place" ? (
        <PlaceCharacterSheet
          characters={state.characters}
          onClose={() => setSheet({ kind: "none" })}
          onPick={(characterId) => {
            if (!state.map) return;
            void stream.placeCharacter(state.map.id, characterId);
            setSheet({ kind: "none" });
          }}
        />
      ) : null}

      {sheet.kind === "filter" ? (
        <MapFilterSheet
          cats={filter.cats}
          hidden={filter.hidden}
          onToggle={(key) => filter.toggle(key as MapFilterCategory)}
          onClear={filter.clear}
          onClose={() => setSheet({ kind: "none" })}
        />
      ) : null}

      {sheet.kind === "create-map" ? (
        <CreateMapSheet
          universes={state.universes}
          defaultUniverseId={state.universe?.id ?? null}
          onClose={() => setSheet({ kind: "none" })}
          onSave={(universeId, name) => {
            void stream.createMap(universeId, name).then(() => setSheet({ kind: "none" }));
          }}
        />
      ) : null}
    </div>
  );
}
