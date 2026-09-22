"use client";

import L from "leaflet";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { characterMarkerHtml } from "./character-marker";
import {
  imageOverlayBounds,
  latLngToRelative,
  relativeToLatLng,
} from "./coords";
import "./karte.css";
import "leaflet/dist/leaflet.css";
import {
  SPIKE_PIN_TYPE_META,
  pinMarkerHtml,
  pinTypeIconUrl,
  pinTypeMeta,
  type SpikePinType,
} from "./pin-types";
import type {
  SpikeKarteState,
  SpikeMarkerDto,
  SpikePinDto,
  SpikeRealtimeEvent,
} from "./types";

/** Spike T-009 — Leaflet CRS.Simple, Client-only, Handy zuerst. */

const MAP_ACTIONS = [{ id: "place-pin", label: "Pin setzen" }] as const;

type Sheet =
  | { kind: "none" }
  | { kind: "actions" }
  | { kind: "create" }
  | { kind: "edit"; pinId: string }
  | { kind: "view"; pinId: string };

type Props = {
  highlightPinId?: string;
  initialState: SpikeKarteState;
};

export default function KarteBoard({ highlightPinId, initialState }: Props) {
  const router = useRouter();
  const mapEl = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const overlayRef = useRef<L.ImageOverlay | null>(null);
  const pinMarkers = useRef(new Map<string, L.Marker>());
  const markerRef = useRef<L.Marker | null>(null);
  const dragging = useRef(new Set<string>());
  const stateRef = useRef<SpikeKarteState>(initialState);
  const placingRef = useRef(false);
  const titleRef = useRef("");
  const descriptionRef = useRef("");
  const typeRef = useRef<SpikePinType>("danger");
  const highlighted = useRef(false);
  const holdTimer = useRef<number | undefined>(undefined);

  const [state, setState] = useState<SpikeKarteState>(initialState);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [placing, setPlacing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [pinType, setPinType] = useState<SpikePinType>("danger");
  const [sheet, setSheet] = useState<Sheet>({ kind: "none" });
  const [savingPin, setSavingPin] = useState(false);

  useEffect(() => {
    placingRef.current = placing;
    titleRef.current = title;
    descriptionRef.current = description;
    typeRef.current = pinType;
    stateRef.current = state;
  }, [placing, title, description, pinType, state]);

  const openPinSheet = useCallback((pin: SpikePinDto) => {
    setError(null);
    setPlacing(false);
    setTitle(pin.title);
    setDescription(pin.description ?? "");
    setPinType(pin.pinType);
    setSheet(pin.locked ? { kind: "view", pinId: pin.id } : { kind: "edit", pinId: pin.id });
  }, []);

  const openPinSheetRef = useRef(openPinSheet);
  openPinSheetRef.current = openPinSheet;

  const loadState = useCallback(async () => {
    const response = await fetch("/api/spike/karte", { credentials: "include" });
    if (response.status === 401) {
      router.replace("/");
      return;
    }
    if (!response.ok) {
      setError("Kartenstand konnte nicht geladen werden.");
      return;
    }
    const next = (await response.json()) as SpikeKarteState;
    setState(next);
  }, [router]);

  useEffect(() => {
    const source = new EventSource("/api/spike/karte/events");
    source.onmessage = (message) => {
      const event = JSON.parse(message.data) as SpikeRealtimeEvent;
      if (event.type === "hello") return;
      if (event.type === "map.updated") {
        void loadState();
        return;
      }
      if (event.type === "pin.upsert") {
        if (dragging.current.has(event.pin.id)) return;
        setState((current) => {
          if (!current) return current;
          const others = current.pins.filter((pin) => pin.id !== event.pin.id);
          return { ...current, pins: [...others, event.pin] };
        });
        return;
      }
      if (event.type === "marker.upsert") {
        if (dragging.current.has(event.marker.id)) return;
        setState((current) =>
          current ? { ...current, marker: event.marker } : current,
        );
      }
    };
    source.onerror = () => {
      /* Browser reconnects EventSource automatically. */
    };
    return () => source.close();
  }, [loadState]);

  const persistPinMove = useCallback(async (pin: SpikePinDto) => {
    const response = await fetch(`/api/spike/karte/pins/${pin.id}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ posX: pin.posX, posY: pin.posY }),
    });
    if (!response.ok) {
      setError(response.status === 409 ? "Pin ist gesperrt." : "Pin konnte nicht verschoben werden.");
      void loadState();
    }
  }, [loadState]);

  const persistMarkerMove = useCallback(async (marker: SpikeMarkerDto) => {
    await fetch(`/api/spike/karte/markers/${marker.id}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ posX: marker.posX, posY: marker.posY }),
    });
  }, []);

  const createPin = useCallback(async (posX: number, posY: number) => {
    const trimmed = titleRef.current.trim();
    if (!trimmed) {
      setError("Titel ist Pflicht.");
      return;
    }
    setError(null);
    const response = await fetch("/api/spike/karte/pins", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pinType: typeRef.current,
        title: trimmed,
        description: descriptionRef.current.trim() || undefined,
        posX,
        posY,
      }),
    });
    if (!response.ok) {
      setError("Pin konnte nicht gespeichert werden.");
      return;
    }
    const payload = (await response.json()) as { pin: SpikePinDto };
    setState((current) => {
      if (!current) return current;
      const others = current.pins.filter((item) => item.id !== payload.pin.id);
      return { ...current, pins: [...others, payload.pin] };
    });
    setPlacing(false);
    setSheet({ kind: "none" });
    setTitle("");
    setDescription("");
  }, []);

  useEffect(() => {
    const container = mapEl.current;
    const mapData = state?.map;
    if (!container || !mapData) {
      mapRef.current?.remove();
      mapRef.current = null;
      overlayRef.current = null;
      pinMarkers.current.clear();
      markerRef.current = null;
      return;
    }

    if (!mapRef.current) {
      const map = L.map(container, {
        crs: L.CRS.Simple,
        minZoom: -5,
        maxZoom: 4,
        zoomSnap: 0,
        zoomDelta: 0.5,
        wheelPxPerZoomLevel: 20,
        scrollWheelZoom: true,
        touchZoom: true,
        bounceAtZoomLimits: true,
        attributionControl: false,
        zoomControl: false,
      });
      L.control.zoom({ position: "topright" }).addTo(map);
      mapRef.current = map;
      map.on("click", (event: L.LeafletMouseEvent) => {
        if (!placingRef.current) return;
        const current = stateRef.current?.map;
        if (!current) return;
        const relative = latLngToRelative(
          event.latlng.lat,
          event.latlng.lng,
          current.imageWidth,
          current.imageHeight,
        );
        void createPin(relative.x, relative.y);
      });
    }

    const map = mapRef.current;
    const bounds = L.latLngBounds(imageOverlayBounds(mapData.imageWidth, mapData.imageHeight));
    if (overlayRef.current) {
      overlayRef.current.setUrl(mapData.imageUrl);
      overlayRef.current.setBounds(bounds);
    } else {
      overlayRef.current = L.imageOverlay(mapData.imageUrl, bounds, {
        interactive: false,
      }).addTo(map);
      map.fitBounds(bounds);
    }
  }, [state?.map, createPin]);

  useEffect(() => {
    const map = mapRef.current;
    const mapData = state?.map;
    if (!map || !mapData) return;

    const seen = new Set<string>();
    for (const pin of state.pins) {
      seen.add(pin.id);
      const latlng = relativeToLatLng(pin.posX, pin.posY, mapData.imageWidth, mapData.imageHeight);
      const highlight = highlightPinId === pin.id;
      const icon = L.divIcon({
        className: highlight
          ? "spike-pin-marker spike-pin-highlight"
          : "spike-pin-marker",
        html: pinMarkerHtml(pin.pinType, pin.locked),
        iconSize: [56, 72],
        iconAnchor: [28, 70],
        popupAnchor: [0, -58],
      });
      let leafletMarker = pinMarkers.current.get(pin.id);
      if (!leafletMarker) {
        leafletMarker = L.marker([latlng.lat, latlng.lng], {
          draggable: !pin.locked,
          icon,
          autoPan: true,
          keyboard: false,
        }).addTo(map);
        leafletMarker.on("click", () => {
          if (placingRef.current) return;
          const current = stateRef.current?.pins.find((item) => item.id === pin.id);
          if (current) openPinSheetRef.current(current);
        });
        leafletMarker.on("dragstart", () => {
          const current = stateRef.current?.pins.find((item) => item.id === pin.id);
          if (current?.locked) {
            leafletMarker?.dragging?.disable();
            return;
          }
          dragging.current.add(pin.id);
        });
        leafletMarker.on("dragend", () => {
          const currentMap = stateRef.current?.map;
          const currentPin = stateRef.current?.pins.find((item) => item.id === pin.id);
          const marker = pinMarkers.current.get(pin.id);
          dragging.current.delete(pin.id);
          if (!currentMap || !marker || !currentPin || currentPin.locked) return;
          const next = latLngToRelative(
            marker.getLatLng().lat,
            marker.getLatLng().lng,
            currentMap.imageWidth,
            currentMap.imageHeight,
          );
          const updated: SpikePinDto = { ...currentPin, posX: next.x, posY: next.y };
          setState((existing) =>
            existing
              ? {
                  ...existing,
                  pins: existing.pins.map((item) =>
                    item.id === pin.id ? updated : item,
                  ),
                }
              : existing,
          );
          void persistPinMove(updated);
        });
        pinMarkers.current.set(pin.id, leafletMarker);
      } else if (!dragging.current.has(pin.id)) {
        leafletMarker.setLatLng([latlng.lat, latlng.lng]);
        leafletMarker.setIcon(icon);
        if (pin.locked) {
          leafletMarker.dragging?.disable();
        } else {
          leafletMarker.dragging?.enable();
        }
      }
    }

    for (const [id, leafletMarker] of pinMarkers.current) {
      if (!seen.has(id)) {
        leafletMarker.remove();
        pinMarkers.current.delete(id);
      }
    }

    if (state.marker) {
      const marker = state.marker;
      const latlng = relativeToLatLng(
        marker.posX,
        marker.posY,
        mapData.imageWidth,
        mapData.imageHeight,
      );
      const icon = L.divIcon({
        className: "spike-character-marker",
        html: characterMarkerHtml(marker.name),
        iconSize: [96, 88],
        iconAnchor: [48, 88],
      });
      if (!markerRef.current) {
        const leafletMarker = L.marker([latlng.lat, latlng.lng], {
          draggable: false,
          icon,
          autoPan: true,
          keyboard: false,
        }).addTo(map);
        markerRef.current = leafletMarker;

        const armDrag = () => {
          window.clearTimeout(holdTimer.current);
          holdTimer.current = window.setTimeout(() => {
            leafletMarker.dragging?.enable();
          }, 220);
        };
        const cancelArm = () => {
          window.clearTimeout(holdTimer.current);
        };
        leafletMarker.on("mousedown", armDrag);
        leafletMarker.on("mouseup", cancelArm);
        leafletMarker.on("touchstart", armDrag);
        leafletMarker.on("touchend", cancelArm);
        leafletMarker.on("dragstart", () => {
          window.clearTimeout(holdTimer.current);
          dragging.current.add(marker.id);
        });
        leafletMarker.on("dragend", () => {
          const current = stateRef.current?.map;
          dragging.current.delete(marker.id);
          leafletMarker.dragging?.disable();
          if (!current) return;
          const next = latLngToRelative(
            leafletMarker.getLatLng().lat,
            leafletMarker.getLatLng().lng,
            current.imageWidth,
            current.imageHeight,
          );
          const updated: SpikeMarkerDto = {
            ...marker,
            posX: next.x,
            posY: next.y,
          };
          setState((existing) =>
            existing ? { ...existing, marker: updated } : existing,
          );
          void persistMarkerMove(updated);
        });
      } else if (!dragging.current.has(marker.id)) {
        markerRef.current.setLatLng([latlng.lat, latlng.lng]);
        markerRef.current.setIcon(icon);
      }
    }

    if (highlightPinId && !highlighted.current) {
      const pin = state.pins.find((item) => item.id === highlightPinId);
      const leafletMarker = pin ? pinMarkers.current.get(pin.id) : undefined;
      if (pin && leafletMarker) {
        highlighted.current = true;
        const focus = relativeToLatLng(
          pin.posX,
          pin.posY,
          mapData.imageWidth,
          mapData.imageHeight,
        );
        map.setView([focus.lat, focus.lng], Math.max(map.getZoom(), 0));
        openPinSheetRef.current(pin);
      }
    }
  }, [state, highlightPinId, persistPinMove, persistMarkerMove]);

  async function onUpload(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    setError(null);
    setWarning(null);
    try {
      const body = new FormData();
      body.set("image", file);
      const response = await fetch("/api/spike/karte/upload", {
        method: "POST",
        credentials: "include",
        body,
      });
      const payload = (await response.json()) as {
        error?: string;
        warning?: string | null;
      };
      if (!response.ok) {
        setError(payload.error ?? "Upload fehlgeschlagen.");
        return;
      }
      if (payload.warning) setWarning(payload.warning);
      await loadState();
    } finally {
      setUploading(false);
    }
  }

  function closeSheet() {
    setSheet({ kind: "none" });
    if (!placing) {
      setError(null);
    }
  }

  function startPlacePin() {
    if (!title.trim()) {
      setError("Titel ist Pflicht.");
      return;
    }
    setError(null);
    setSheet({ kind: "none" });
    setPlacing(true);
  }

  function onMapAction(id: (typeof MAP_ACTIONS)[number]["id"]) {
    if (id === "place-pin") {
      setTitle("");
      setDescription("");
      setPinType("danger");
      setError(null);
      setSheet({ kind: "create" });
    }
  }

  async function patchPin(id: string, body: Record<string, unknown>) {
    setSavingPin(true);
    setError(null);
    try {
      const response = await fetch(`/api/spike/karte/pins/${id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        setError(
          response.status === 409
            ? "Pin ist gesperrt."
            : "Pin konnte nicht gespeichert werden.",
        );
        return null;
      }
      const payload = (await response.json()) as { pin: SpikePinDto };
      setState((current) => {
        if (!current) return current;
        return {
          ...current,
          pins: current.pins.map((item) =>
            item.id === payload.pin.id ? payload.pin : item,
          ),
        };
      });
      return payload.pin;
    } finally {
      setSavingPin(false);
    }
  }

  async function saveEditedPin(pinId: string) {
    const trimmed = title.trim();
    if (!trimmed) {
      setError("Titel ist Pflicht.");
      return;
    }
    const pin = await patchPin(pinId, {
      title: trimmed,
      description: description.trim() || null,
      pinType,
    });
    if (pin) setSheet({ kind: "none" });
  }

  async function lockPin(pinId: string) {
    const pin = await patchPin(pinId, { locked: true });
    if (pin) setSheet({ kind: "view", pinId });
  }

  async function unlockPin(pinId: string) {
    const pin = await patchPin(pinId, { locked: false });
    if (pin) {
      setTitle(pin.title);
      setDescription(pin.description ?? "");
      setPinType(pin.pinType);
      setSheet({ kind: "edit", pinId });
    }
  }

  const selectedPin =
    sheet.kind === "edit" || sheet.kind === "view"
      ? state.pins.find((pin) => pin.id === sheet.pinId)
      : undefined;
  const sheetOpen = sheet.kind !== "none" && sheet.kind !== "actions";

  return (
    <div className="spike-karte">
      {state?.map ? (
        <div ref={mapEl} className="spike-karte-map" />
      ) : (
        <section className="spike-empty">
          <p className="text-sm uppercase tracking-wide text-zinc-400">Spike T-009</p>
          <h1 className="text-2xl font-semibold">Karten-Whiteboard</h1>
          <p className="text-zinc-300">
            Lade dein eigenes Kartenbild hoch (JPEG, PNG oder WebP, max. 20 MB).
            8000×6000 wird unterstützt — es gibt kein Seed-Bild.
          </p>
        </section>
      )}

      <header className="spike-chrome">
        <Link href="/">Start</Link>
        <label className="spike-upload">
          Karte hochladen
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={uploading}
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              void onUpload(file);
            }}
          />
        </label>
        {state?.map ? (
          <span className="spike-hint">
            {state.map.imageWidth}×{state.map.imageHeight}px
          </span>
        ) : null}
      </header>

      {placing ? (
        <div className="spike-place-banner" role="status">
          <p>Tippe auf die Karte, um den Pin zu setzen.</p>
          <button type="button" onClick={() => setPlacing(false)}>
            Abbrechen
          </button>
        </div>
      ) : null}

      {error ? <p className="spike-toast spike-error">{error}</p> : null}
      {warning ? <p className="spike-toast spike-warn">{warning}</p> : null}

      {state?.map && !placing && !sheetOpen ? (
        <>
          {sheet.kind === "actions" ? (
            <div className="spike-action-sheet" role="menu" aria-label="Kartenaktionen">
              {MAP_ACTIONS.map((action) => (
                <button
                  key={action.id}
                  type="button"
                  role="menuitem"
                  onClick={() => onMapAction(action.id)}
                >
                  {action.label}
                </button>
              ))}
            </div>
          ) : null}
          <button
            type="button"
            className="spike-fab"
            aria-expanded={sheet.kind === "actions"}
            aria-label={sheet.kind === "actions" ? "Aktionen schließen" : "Aktionen"}
            onClick={() =>
              setSheet((current) =>
                current.kind === "actions" ? { kind: "none" } : { kind: "actions" },
              )
            }
          >
            {sheet.kind === "actions" ? "×" : "+"}
          </button>
        </>
      ) : null}

      {sheetOpen ? (
        <button
          type="button"
          className="spike-sheet-backdrop"
          aria-label="Schließen"
          onClick={closeSheet}
        />
      ) : null}

      {sheet.kind === "create" ? (
        <form
          className="spike-sheet"
          onSubmit={(event) => {
            event.preventDefault();
            startPlacePin();
          }}
        >
          <div className="spike-sheet-handle" aria-hidden="true" />
          <h2>Pin setzen</h2>
          <PinFields
            pinType={pinType}
            title={title}
            description={description}
            onType={setPinType}
            onTitle={setTitle}
            onDescription={setDescription}
          />
          <div className="spike-sheet-actions">
            <button type="submit">Auf die Karte tippen</button>
            <button type="button" className="spike-secondary" onClick={closeSheet}>
              Abbrechen
            </button>
          </div>
        </form>
      ) : null}

      {sheet.kind === "edit" && selectedPin ? (
        <form
          className="spike-sheet"
          onSubmit={(event) => {
            event.preventDefault();
            void saveEditedPin(selectedPin.id);
          }}
        >
          <div className="spike-sheet-handle" aria-hidden="true" />
          <h2>Pin bearbeiten</h2>
          <PinFields
            pinType={pinType}
            title={title}
            description={description}
            onType={setPinType}
            onTitle={setTitle}
            onDescription={setDescription}
          />
          <div className="spike-sheet-actions">
            <button type="submit" disabled={savingPin}>
              Speichern
            </button>
            <button
              type="button"
              className="spike-secondary"
              disabled={savingPin}
              onClick={() => void lockPin(selectedPin.id)}
            >
              Sperren
            </button>
            <button type="button" className="spike-secondary" onClick={closeSheet}>
              Schließen
            </button>
          </div>
        </form>
      ) : null}

      {sheet.kind === "view" && selectedPin ? (
        <section className="spike-sheet">
          <div className="spike-sheet-handle" aria-hidden="true" />
          <h2>{selectedPin.title}</h2>
          <p className="spike-hint">
            {pinTypeMeta(selectedPin.pinType).label} · gesperrt
          </p>
          {selectedPin.description ? <p>{selectedPin.description}</p> : null}
          <p className="spike-hint">
            Zum Bearbeiten oder Verschieben zuerst entsperren.
          </p>
          <div className="spike-sheet-actions">
            <button
              type="button"
              disabled={savingPin}
              onClick={() => void unlockPin(selectedPin.id)}
            >
              Entsperren
            </button>
            <button type="button" className="spike-secondary" onClick={closeSheet}>
              Schließen
            </button>
          </div>
        </section>
      ) : null}
    </div>
  );
}

function PinFields({
  pinType,
  title,
  description,
  onType,
  onTitle,
  onDescription,
}: {
  pinType: SpikePinType;
  title: string;
  description: string;
  onType: (value: SpikePinType) => void;
  onTitle: (value: string) => void;
  onDescription: (value: string) => void;
}) {
  return (
    <>
      <div className="spike-types" role="group" aria-label="Pin-Typen">
        {SPIKE_PIN_TYPE_META.map((meta) => (
          <button
            key={meta.id}
            type="button"
            aria-pressed={pinType === meta.id}
            onClick={() => onType(meta.id)}
          >
            {/* Distinct spike pin icons; data URI, not a map tile. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={pinTypeIconUrl(meta.id)} alt="" />
            {meta.label}
          </button>
        ))}
      </div>
      <label className="spike-field">
        Titel
        <input
          type="text"
          maxLength={120}
          required
          placeholder="Pin-Titel (Pflicht)"
          value={title}
          onChange={(event) => onTitle(event.target.value)}
        />
      </label>
      <label className="spike-field">
        Beschreibung
        <textarea
          rows={3}
          placeholder="Beschreibung (optional)"
          value={description}
          onChange={(event) => onDescription(event.target.value)}
        />
      </label>
    </>
  );
}

