"use client";

import L from "leaflet";
import { useEffect, useRef, useState, type RefObject } from "react";
import { markerPinHtml } from "@/lib/map/marker-pin";
import { imageOverlayBounds, latLngToRelative, relativeToLatLng } from "@/lib/map/coords";
import { PIN_ICON } from "@/lib/map/pin-icon";
import { pinMarkerHtml } from "@/lib/map/pin-types";
import type { MapDto, MarkerDto, MonsterMarkerDto, PinDto } from "@/lib/map/types";
import "leaflet/dist/leaflet.css";

type MapWithImage = MapDto & {
  imageId: string;
  imageUrl: string;
  imageWidth: number;
  imageHeight: number;
};

type Handlers = {
  placing: boolean;
  staff: boolean;
  actorId: string;
  highlightPinId: string | null;
  onMapClick: (x: number, y: number) => void;
  onPinClick: (pin: PinDto) => void;
  onMarkerClick: (marker: MarkerDto) => void;
  onMonsterMarkerClick: (marker: MonsterMarkerDto) => void;
  onPinDrop: (pin: PinDto) => void;
  onMarkerDrop: (marker: MarkerDto) => void;
  onMonsterMarkerDrop: (marker: MonsterMarkerDto) => void;
};

type PositionedMarker = { id: string; posX: number; posY: number };

function syncMarkerPinLayer<T extends PositionedMarker>(input: {
  map: L.Map;
  currentMap: MapWithImage;
  rows: T[];
  rowsRef: Readonly<{ current: T[] }>;
  mapDataRef: Readonly<{ current: MapWithImage | null }>;
  layerRef: Readonly<{ current: Map<string, L.Marker> }>;
  dragging: Set<string>;
  iconFor: (row: T) => L.DivIcon;
  canDrag: (row: T) => boolean;
  onClick: (row: T) => void;
  onDrop: (row: T) => void;
}) {
  const seen = new Set<string>();
  for (const row of input.rows) {
    seen.add(row.id);
    const latlng = relativeToLatLng(
      row.posX,
      row.posY,
      input.currentMap.imageWidth,
      input.currentMap.imageHeight,
    );
    const icon = input.iconFor(row);
    const draggable = input.canDrag(row);
    let marker = input.layerRef.current.get(row.id);
    if (!marker) {
      marker = L.marker([latlng.lat, latlng.lng], {
        draggable,
        icon,
        autoPan: true,
        keyboard: false,
      }).addTo(input.map);
      marker.on("click", () => {
        const live = input.rowsRef.current.find((item) => item.id === row.id);
        if (live) input.onClick(live);
      });
      marker.on("dragstart", () => input.dragging.add(row.id));
      marker.on("dragend", () => {
        const liveMap = input.mapDataRef.current;
        const live = input.rowsRef.current.find((item) => item.id === row.id);
        const layer = input.layerRef.current.get(row.id);
        input.dragging.delete(row.id);
        if (!liveMap || !layer || !live) return;
        const next = latLngToRelative(
          layer.getLatLng().lat,
          layer.getLatLng().lng,
          liveMap.imageWidth,
          liveMap.imageHeight,
        );
        input.onDrop({ ...live, posX: next.x, posY: next.y });
      });
      input.layerRef.current.set(row.id, marker);
    } else if (!input.dragging.has(row.id)) {
      marker.setLatLng([latlng.lat, latlng.lng]);
      marker.setIcon(icon);
      if (draggable) marker.dragging?.enable();
      else marker.dragging?.disable();
    }
  }
  for (const [id, layer] of input.layerRef.current) {
    if (!seen.has(id)) {
      layer.remove();
      input.layerRef.current.delete(id);
    }
  }
}

export function useLeafletMap(
  containerRef: RefObject<HTMLDivElement | null>,
  mapData: MapWithImage | null,
  pins: PinDto[],
  markers: MarkerDto[],
  monsterMarkers: MonsterMarkerDto[],
  handlers: Handlers,
) {
  const mapRef = useRef<L.Map | null>(null);
  const overlayRef = useRef<L.ImageOverlay | null>(null);
  const pinMarkers = useRef(new Map<string, L.Marker>());
  const markerLayer = useRef(new Map<string, L.Marker>());
  const monsterLayer = useRef(new Map<string, L.Marker>());
  const [dragging] = useState(() => new Set<string>());
  const fittedKey = useRef<string | null>(null);
  const pinsRef = useRef(pins);
  const markersRef = useRef(markers);
  const monsterMarkersRef = useRef(monsterMarkers);
  const mapDataRef = useRef(mapData);
  const handlersRef = useRef(handlers);

  useEffect(() => {
    pinsRef.current = pins;
    markersRef.current = markers;
    monsterMarkersRef.current = monsterMarkers;
    mapDataRef.current = mapData;
  }, [pins, markers, monsterMarkers, mapData]);

  useEffect(() => {
    handlersRef.current = handlers;
  }, [handlers]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !mapData) {
      mapRef.current?.remove();
      mapRef.current = null;
      overlayRef.current = null;
      pinMarkers.current.clear();
      markerLayer.current.clear();
      monsterLayer.current.clear();
      fittedKey.current = null;
      return;
    }

    if (!mapRef.current) {
      const map = L.map(container, {
        crs: L.CRS.Simple,
        minZoom: -5,
        maxZoom: 4,
        zoomSnap: 0,
        zoomDelta: 0.5,
        attributionControl: false,
        zoomControl: false,
        // Custom wheel below (prototype-like continuous sensitivity).
        scrollWheelZoom: false,
        touchZoom: true,
        wheelPxPerZoomLevel: 40,
      });
      mapRef.current = map;
      const onWheel = (event: WheelEvent) => {
        event.preventDefault();
        // Match spikes/ui-prototype: scale *= exp(-deltaY * 0.0022) → Δzoom = -deltaY * 0.0022 / ln(2)
        const delta = (-event.deltaY * 0.0022) / Math.LN2;
        const next = Math.min(4, Math.max(-5, map.getZoom() + delta));
        map.setZoom(next, { animate: false });
      };
      container.addEventListener("wheel", onWheel, { passive: false });
      map.once("unload", () => container.removeEventListener("wheel", onWheel));
      map.on("click", (event: L.LeafletMouseEvent) => {
        if (!handlersRef.current.placing) return;
        const current = mapDataRef.current;
        if (!current) return;
        const relative = latLngToRelative(
          event.latlng.lat,
          event.latlng.lng,
          current.imageWidth,
          current.imageHeight,
        );
        handlersRef.current.onMapClick(relative.x, relative.y);
      });
    }

    const map = mapRef.current;
    const bounds = L.latLngBounds(imageOverlayBounds(mapData.imageWidth, mapData.imageHeight));
    if (overlayRef.current) {
      overlayRef.current.setUrl(mapData.imageUrl);
      overlayRef.current.setBounds(bounds);
    } else {
      overlayRef.current = L.imageOverlay(mapData.imageUrl, bounds, { interactive: false }).addTo(map);
    }

    const key = `${mapData.id}:${mapData.updatedAt}:${handlers.highlightPinId ?? ""}`;
    if (fittedKey.current !== key) {
      fittedKey.current = key;
      const highlight = handlers.highlightPinId
        ? pinsRef.current.find((pin) => pin.id === handlers.highlightPinId)
        : null;
      if (highlight) {
        const latlng = relativeToLatLng(highlight.posX, highlight.posY, mapData.imageWidth, mapData.imageHeight);
        map.setView([latlng.lat, latlng.lng], 1, { animate: false });
      } else {
        map.fitBounds(bounds);
      }
    }
  }, [mapData, handlers.highlightPinId, containerRef]);

  useEffect(() => {
    const map = mapRef.current;
    const currentMap = mapDataRef.current;
    if (!map || !currentMap) return;
    const seen = new Set<string>();
    for (const pin of pins) {
      seen.add(pin.id);
      const latlng = relativeToLatLng(pin.posX, pin.posY, currentMap.imageWidth, currentMap.imageHeight);
      const highlight = handlers.highlightPinId === pin.id;
      const icon = L.divIcon({
        className: highlight ? "map-pin map-pin-hl" : "map-pin",
        html: pinMarkerHtml(pin.pinType, pin.locked),
        iconSize: [...PIN_ICON.size],
        iconAnchor: [...PIN_ICON.anchor],
      });
      let marker = pinMarkers.current.get(pin.id);
      if (!marker) {
        marker = L.marker([latlng.lat, latlng.lng], {
          draggable: handlers.staff && !pin.locked,
          icon,
          autoPan: true,
          keyboard: false,
        }).addTo(map);
        marker.on("click", () => {
          const live = pinsRef.current.find((row) => row.id === pin.id);
          if (live) handlersRef.current.onPinClick(live);
        });
        marker.on("dragstart", () => dragging.add(pin.id));
        marker.on("dragend", () => {
          const liveMap = mapDataRef.current;
          const livePin = pinsRef.current.find((row) => row.id === pin.id);
          const layer = pinMarkers.current.get(pin.id);
          dragging.delete(pin.id);
          if (!liveMap || !layer || !livePin || livePin.locked) return;
          const next = latLngToRelative(
            layer.getLatLng().lat,
            layer.getLatLng().lng,
            liveMap.imageWidth,
            liveMap.imageHeight,
          );
          handlersRef.current.onPinDrop({ ...livePin, posX: next.x, posY: next.y });
        });
        pinMarkers.current.set(pin.id, marker);
      } else if (!dragging.has(pin.id)) {
        marker.setLatLng([latlng.lat, latlng.lng]);
        marker.setIcon(icon);
        if (handlers.staff && !pin.locked) marker.dragging?.enable();
        else marker.dragging?.disable();
      }
    }
    for (const [id, layer] of pinMarkers.current) {
      if (!seen.has(id)) {
        layer.remove();
        pinMarkers.current.delete(id);
      }
    }
  }, [pins, handlers.staff, handlers.highlightPinId, dragging]);

  useEffect(() => {
    const map = mapRef.current;
    const currentMap = mapDataRef.current;
    if (!map || !currentMap) return;
    syncMarkerPinLayer({
      map,
      currentMap,
      rows: markers,
      rowsRef: markersRef,
      mapDataRef,
      layerRef: markerLayer,
      dragging,
      iconFor: (row) => L.divIcon({
        className: "map-marker-leaflet",
        html: markerPinHtml({
          name: row.name,
          imageUrl: row.portraitId ? `/api/files/${row.portraitId}` : null,
          variant: "character",
        }),
        iconSize: [...PIN_ICON.size],
        iconAnchor: [...PIN_ICON.anchor],
      }),
      canDrag: (row) => handlers.staff || handlers.actorId === row.ownerId,
      onClick: (row) => handlersRef.current.onMarkerClick(row),
      onDrop: (row) => handlersRef.current.onMarkerDrop(row),
    });
  }, [markers, handlers.staff, handlers.actorId, dragging]);

  useEffect(() => {
    const map = mapRef.current;
    const currentMap = mapDataRef.current;
    if (!map || !currentMap) return;
    syncMarkerPinLayer({
      map,
      currentMap,
      rows: monsterMarkers,
      rowsRef: monsterMarkersRef,
      mapDataRef,
      layerRef: monsterLayer,
      dragging,
      iconFor: (row) => L.divIcon({
        className: "map-marker-leaflet",
        html: markerPinHtml({
          name: row.name,
          imageUrl: row.imageUrl,
          variant: "monster",
        }),
        iconSize: [...PIN_ICON.size],
        iconAnchor: [...PIN_ICON.anchor],
      }),
      canDrag: () => handlers.staff,
      onClick: (row) => handlersRef.current.onMonsterMarkerClick(row),
      onDrop: (row) => handlersRef.current.onMonsterMarkerDrop(row),
    });
  }, [monsterMarkers, handlers.staff, dragging]);

  function zoomBy(factor: number) {
    const map = mapRef.current;
    if (!map) return;
    // Prototype multiplies scale by 1.4 / 0.7 → Leaflet zoom += log2(factor).
    map.setZoom(map.getZoom() + Math.log2(factor), { animate: true });
  }

  function fit() {
    const map = mapRef.current;
    const current = mapDataRef.current;
    if (!map || !current) return;
    map.fitBounds(L.latLngBounds(imageOverlayBounds(current.imageWidth, current.imageHeight)));
  }

  return { dragging, zoomBy, fit };
}
