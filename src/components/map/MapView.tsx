"use client";

import { Ellipsis, Filter } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ImageUploadField } from "@/components/files/ImageUploadField";
import { rememberUniverse } from "@/lib/client/last-context";
import type { MapDto, MapState, MarkerDto, MonsterMarkerDto, PinDetails } from "@/lib/map/types";
import { useMapRealtime } from "./use-map-realtime";
import { useLeafletMap } from "./use-leaflet-map";
import { useMapState } from "./use-map-state";
import {
  CreateMapSheet,
  MapFilterSheet,
  MapToolsSheet,
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
import { isMapFilterVisible } from "@/lib/map/map-filter";
import { MAP_TOOLS, mapModeHint, nextMapMode, resolveMapTap, tapOnItemPosition, type MapMode } from "@/lib/map/map-mode";

type Sheet =
  | { kind: "none" }
  | { kind: "view"; pin: PinDetails }
  | { kind: "create"; posX: number; posY: number }
  | { kind: "edit"; pin: PinDetails }
  | { kind: "marker"; marker: MarkerDto }
  | { kind: "monster-marker"; marker: MonsterMarkerDto }
  | { kind: "monster-pick"; posX: number; posY: number }
  | { kind: "place"; posX: number; posY: number }
  | { kind: "filter" }
  | { kind: "tools" }
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
  const [mode, setMode] = useState<MapMode>({ kind: "none" });
  const [sheet, setSheet] = useState<Sheet>({ kind: "none" });
  const [replaceConfirm, setReplaceConfirm] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const placing = mode.kind !== "none";

  useEffect(() => {
    if (state.universe) rememberUniverse(worldId, state.universe.id);
  }, [worldId, state.universe]);

  // K12: changing maps ends place/copy mode.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset tool mode when the selected map changes
    setMode({ kind: "none" });
  }, [state.map?.id]);

  const onResync = useCallback(() => {
    stream.onResync();
  }, [stream]);

  const leafletMap = mapHasImage(state.map) ? state.map : null;

  const visiblePins = useMemo(
    () =>
      state.pins.filter((pin) =>
        isMapFilterVisible(
          { kind: "pin", pinType: pin.pinType, highlighted: state.highlightPinId === pin.id },
          filter.hidden,
        ),
      ),
    [state.pins, state.highlightPinId, filter.hidden],
  );
  const visibleMarkers = useMemo(
    () => (isMapFilterVisible({ kind: "character" }, filter.hidden) ? state.markers : []),
    [state.markers, filter.hidden],
  );
  const visibleMonsterMarkers = useMemo(
    () => (isMapFilterVisible({ kind: "monster" }, filter.hidden) ? state.monsterMarkers : []),
    [state.monsterMarkers, filter.hidden],
  );

  const placeAt = useCallback(
    (x: number, y: number) => {
      const action = resolveMapTap(mode);
      if (action === "none") return;
      if (action === "copy" && mode.kind === "copy") {
        // K11: copy mode stays active for further taps.
        void stream.copyMonsterMarker(mode.source.id, x, y);
        return;
      }
      setMode({ kind: "none" });
      if (action === "pick-monster") setSheet({ kind: "monster-pick", posX: x, posY: y });
      else if (action === "pick-character") setSheet({ kind: "place", posX: x, posY: y });
      else if (action === "create-pin") setSheet({ kind: "create", posX: x, posY: y });
    },
    [mode, stream],
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
      onMapClick: placeAt,
      onPinClick: (pin) => {
        if (mode.kind !== "none") {
          const position = tapOnItemPosition(pin.posX, pin.posY);
          placeAt(position.x, position.y);
          return;
        }
        void stream.loadPin(pin.id).then((details) => {
          if (details) setSheet({ kind: "view", pin: details });
        });
      },
      onMarkerClick: (marker) => {
        if (mode.kind !== "none") {
          const position = tapOnItemPosition(marker.posX, marker.posY);
          placeAt(position.x, position.y);
          return;
        }
        setSheet({ kind: "marker", marker });
      },
      onMonsterMarkerClick: (marker) => {
        if (mode.kind !== "none") {
          const position = tapOnItemPosition(marker.posX, marker.posY);
          placeAt(position.x, position.y);
          return;
        }
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
    sheetOpen: sheet.kind !== "none" || replaceConfirm,
    setMode,
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
        </div>
      </div>

      {state.map && (state.staff || mapHasImage(state.map)) ? (
        <div className="map-context-ctrl">
          {/* Map management must work without an image, too (CR-017). */}
          {state.staff ? (
            <button type="button" className="zbtn" aria-label="Kartenverwaltung" title="Kartenverwaltung" onClick={() => setSheet({ kind: "tools" })}>
              <Ellipsis size={20} aria-hidden />
            </button>
          ) : null}
          {mapHasImage(state.map) ? (
            <>
              <button type="button" className="zbtn" aria-label="Hineinzoomen" title="Hineinzoomen" onClick={() => leaflet.zoomBy(1.4)}>＋</button>
              <button type="button" className="zbtn" aria-label="Herauszoomen" title="Herauszoomen" onClick={() => leaflet.zoomBy(0.7)}>－</button>
              <button type="button" className="zbtn" aria-label="Ganze Karte" title="Ganze Karte" onClick={() => leaflet.fit()}>⤢</button>
            </>
          ) : null}
        </div>
      ) : null}

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
          {mapHasImage(state.map) ? (
            <>
              {MAP_TOOLS.filter((tool) => state.staff || !tool.staffOnly).map((tool) => {
                const active = mode.kind === tool.kind;
                const label = tool.hotkey ? `${tool.label} (${tool.hotkey})` : tool.label;
                return (
                  <button
                    key={tool.kind}
                    type="button"
                    className={active ? "zbtn on" : "zbtn"}
                    aria-label={active ? tool.cancelLabel : label}
                    aria-keyshortcuts={active ? "Escape" : (tool.hotkey ?? undefined)}
                    title={active ? `${tool.cancelLabel} (Esc)` : label}
                    onClick={() => setMode((current) => nextMapMode(current, tool.kind))}
                  >
                    {active ? "❌" : tool.icon}
                  </button>
                );
              })}
              {mode.kind === "copy" ? (
                // K11: copy mode has no tool button of its own, so it needs its own cancel.
                <button
                  type="button"
                  className="zbtn on"
                  aria-label="Kopiermodus beenden"
                  aria-keyshortcuts="Escape"
                  title="Kopiermodus beenden (Esc)"
                  onClick={() => setMode({ kind: "none" })}
                >
                  ❌
                </button>
              ) : null}
              <button
                type="button"
                className={filter.hasOff ? "zbtn map-filter-btn has-off" : "zbtn map-filter-btn"}
                aria-label="Kartenfilter"
                title="Kartenfilter"
                onClick={() => setSheet({ kind: "filter" })}
              >
                <Filter size={20} aria-hidden />
              </button>
            </>
          ) : null}
        </div>
      ) : null}

      {mapModeHint(mode) ? <p className="map-hint">{mapModeHint(mode)}</p> : null}

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
            setMode({ kind: "copy", source: sheet.marker });
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
            void stream.placeCharacter(state.map.id, characterId, sheet.posX, sheet.posY);
            setSheet({ kind: "none" });
          }}
        />
      ) : null}

      {sheet.kind === "filter" ? (
        <MapFilterSheet
          cats={filter.cats}
          hidden={filter.hidden}
          onToggle={filter.toggle}
          onClear={filter.clear}
          onHideAll={filter.hideAll}
          onClose={() => setSheet({ kind: "none" })}
        />
      ) : null}

      {sheet.kind === "tools" && state.map ? (
        <MapToolsSheet
          mapPublished={mapPublished}
          hasImage={mapHasImage(state.map)}
          onClose={() => setSheet({ kind: "none" })}
          onCreate={() => { setSheet({ kind: "create-map" }); }}
          onDelete={() => { setSheet({ kind: "none" }); onDeleteMap(); }}
          onUpload={() => { setSheet({ kind: "none" }); startUpload(); }}
          onToggleVisibility={() => {
            void stream.setMapVisibility(state.map!.id, mapPublished ? "gm_only" : "published");
            setSheet({ kind: "none" });
          }}
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
