"use client";

import L from "leaflet";
import { useEffect, useRef, useState, type RefObject } from "react";
import { markerPinHtml } from "@/lib/map/character-marker";
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
          if (handlersRef.current.placing) return;
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
    const seen = new Set<string>();
    for (const row of markers) {
      seen.add(row.id);
      const latlng = relativeToLatLng(row.posX, row.posY, currentMap.imageWidth, currentMap.imageHeight);
      const canDrag = handlers.staff || handlers.actorId === row.ownerId;
      const icon = L.divIcon({
        className: "map-marker-leaflet",
        html: markerPinHtml({
          name: row.name,
          imageUrl: row.portraitId ? `/api/files/${row.portraitId}` : null,
          variant: "character",
        }),
        iconSize: [...PIN_ICON.size],
        iconAnchor: [...PIN_ICON.anchor],
      });
      let marker = markerLayer.current.get(row.id);
      if (!marker) {
        marker = L.marker([latlng.lat, latlng.lng], {
          draggable: canDrag,
          icon,
          autoPan: true,
          keyboard: false,
        }).addTo(map);
        marker.on("click", () => {
          const live = markersRef.current.find((item) => item.id === row.id);
          if (live) handlersRef.current.onMarkerClick(live);
        });
        marker.on("dragstart", () => dragging.add(row.id));
        marker.on("dragend", () => {
          const liveMap = mapDataRef.current;
          const live = markersRef.current.find((item) => item.id === row.id);
          const layer = markerLayer.current.get(row.id);
          dragging.delete(row.id);
          if (!liveMap || !layer || !live) return;
          const next = latLngToRelative(
            layer.getLatLng().lat,
            layer.getLatLng().lng,
            liveMap.imageWidth,
            liveMap.imageHeight,
          );
          handlersRef.current.onMarkerDrop({ ...live, posX: next.x, posY: next.y });
        });
        markerLayer.current.set(row.id, marker);
      } else if (!dragging.has(row.id)) {
        marker.setLatLng([latlng.lat, latlng.lng]);
        marker.setIcon(icon);
        if (canDrag) marker.dragging?.enable();
        else marker.dragging?.disable();
      }
    }
    for (const [id, layer] of markerLayer.current) {
      if (!seen.has(id)) {
        layer.remove();
        markerLayer.current.delete(id);
      }
    }
  }, [markers, handlers.staff, handlers.actorId, dragging]);

  useEffect(() => {
    const map = mapRef.current;
    const currentMap = mapDataRef.current;
    if (!map || !currentMap) return;
    const seen = new Set<string>();
    for (const row of monsterMarkers) {
      seen.add(row.id);
      const latlng = relativeToLatLng(row.posX, row.posY, currentMap.imageWidth, currentMap.imageHeight);
      const icon = L.divIcon({
        className: "map-marker-leaflet",
        html: markerPinHtml({
          name: row.name,
          imageUrl: row.imageUrl,
          variant: "monster",
        }),
        iconSize: [...PIN_ICON.size],
        iconAnchor: [...PIN_ICON.anchor],
      });
      let marker = monsterLayer.current.get(row.id);
      if (!marker) {
        marker = L.marker([latlng.lat, latlng.lng], {
          draggable: handlers.staff,
          icon,
          autoPan: true,
          keyboard: false,
        }).addTo(map);
        marker.on("click", () => {
          const live = monsterMarkersRef.current.find((item) => item.id === row.id);
          if (live) handlersRef.current.onMonsterMarkerClick(live);
        });
        marker.on("dragstart", () => dragging.add(row.id));
        marker.on("dragend", () => {
          const liveMap = mapDataRef.current;
          const live = monsterMarkersRef.current.find((item) => item.id === row.id);
          const layer = monsterLayer.current.get(row.id);
          dragging.delete(row.id);
          if (!liveMap || !layer || !live) return;
          const next = latLngToRelative(
            layer.getLatLng().lat,
            layer.getLatLng().lng,
            liveMap.imageWidth,
            liveMap.imageHeight,
          );
          handlersRef.current.onMonsterMarkerDrop({ ...live, posX: next.x, posY: next.y });
        });
        monsterLayer.current.set(row.id, marker);
      } else if (!dragging.has(row.id)) {
        marker.setLatLng([latlng.lat, latlng.lng]);
        marker.setIcon(icon);
        if (handlers.staff) marker.dragging?.enable();
        else marker.dragging?.disable();
      }
    }
    for (const [id, layer] of monsterLayer.current) {
      if (!seen.has(id)) {
        layer.remove();
        monsterLayer.current.delete(id);
      }
    }
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
