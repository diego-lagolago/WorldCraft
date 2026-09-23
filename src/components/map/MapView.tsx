"use client";

import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { rememberUniverse } from "@/lib/client/last-context";
import type { MapState, MarkerDto, PinDetails } from "@/lib/map/types";
import { useMapRealtime } from "./use-map-realtime";
import { useLeafletMap } from "./use-leaflet-map";
import { useMapState } from "./use-map-state";
import { MarkerSheet, PinFormSheet, PinViewSheet, PlaceCharacterSheet } from "./MapSheets";

type Sheet =
  | { kind: "none" }
  | { kind: "view"; pin: PinDetails }
  | { kind: "create"; posX: number; posY: number }
  | { kind: "edit"; pin: PinDetails }
  | { kind: "marker"; marker: MarkerDto }
  | { kind: "place" };

export function MapView({ worldId, initial }: { worldId: string; initial: MapState }) {
  const stream = useMapState(worldId, initial);
  const state = stream.state;
  const [placing, setPlacing] = useState(false);
  const [sheet, setSheet] = useState<Sheet>({ kind: "none" });
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (state.universe) rememberUniverse(worldId, state.universe.id);
  }, [worldId, state.universe]);

  const onResync = useCallback(() => {
    void stream.reload();
  }, [stream]);

  const leaflet = useLeafletMap(containerRef, state.map, state.pins, state.markers, {
    placing,
    staff: state.staff,
    actorId: state.actorId,
    highlightPinId: state.highlightPinId,
    onMapClick: (x, y) => {
      setPlacing(false);
      setSheet({ kind: "create", posX: x, posY: y });
    },
    onPinClick: (pin) => {
      void stream.loadPin(pin.id).then((details) => {
        if (details) setSheet({ kind: "view", pin: details });
      });
    },
    onMarkerClick: (marker) => setSheet({ kind: "marker", marker }),
    onPinDrop: (pin) => void stream.dropPin(pin),
    onMarkerDrop: (marker) => void stream.dropMarker(marker),
  });

  useMapRealtime(worldId, state.universe?.id ?? null, (event) => stream.applyEvent(event, leaflet.dragging), onResync);

  const mapPublished = state.map?.visibility === "published";

  return (
    <div className={placing ? "map-page placing" : "map-page"}>
      <div className="map-top">
        {state.universes.map((universe) => (
          <Link
            key={universe.id}
            className={universe.id === state.universe?.id ? "chip on" : "chip"}
            href={`/w/${worldId}/map?universe=${universe.id}`}
          >
            {universe.name}
            {universe.visibility === "gm_only" ? " · SL" : ""}
          </Link>
        ))}
        {state.staff && state.map ? (
          <label className="chip">
            Bild ersetzen
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              hidden
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file && state.map) void stream.replaceImage(state.map.id, file);
              }}
            />
          </label>
        ) : null}
      </div>

      {state.mapHidden ? (
        <div className="map-empty">
          <div className="card">Diese Karte ist nur für die Spielleitung sichtbar.</div>
        </div>
      ) : state.map ? (
        <div ref={containerRef} className="map-vp" />
      ) : (
        <div className="map-empty">
          <div className="card stack text-center">
            <p>Für dieses Universum gibt es noch keine Karte.</p>
            {state.staff && state.universe ? (
              <label className="btn primary">
                Kartenbild hochladen
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  hidden
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file && state.universe) void stream.uploadMap(state.universe.id, file);
                  }}
                />
              </label>
            ) : null}
          </div>
        </div>
      )}

      {state.map ? (
        <div className="map-ctrl">
          {state.staff ? (
            <button
              type="button"
              className="zbtn"
              aria-label={mapPublished ? "Karte freigegeben" : "Karte versteckt"}
              title={mapPublished ? "Karte freigegeben (für alle sichtbar)" : "Karte versteckt (nur Spielleitung)"}
              onClick={() =>
                void stream.setMapVisibility(state.map!.id, mapPublished ? "gm_only" : "published")
              }
            >
              {mapPublished ? <Eye size={20} aria-hidden /> : <EyeOff size={20} aria-hidden />}
            </button>
          ) : null}
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
            <button
              type="button"
              className="fab"
              aria-label={placing ? "Abbrechen" : "Pin setzen"}
              onClick={() => setPlacing((current) => !current)}
            >
              {placing ? "×" : "+"}
            </button>
          ) : null}
        </div>
      ) : null}

      {placing ? <p className="map-hint">Tippe auf die Karte, um den Pin zu setzen.</p> : null}

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
          initial={{ pinType: "city", title: "", description: null, visibility: "gm_only" }}
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
    </div>
  );
}
