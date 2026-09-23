import { describe, expect, it } from "vitest";
import {
  POSITION_DECIMALS,
  imageOverlayBounds,
  latLngToRelative,
  relativeToLatLng,
  roundPosition,
} from "./coords";

describe("map coords", () => {
  it("keeps at least 6 decimal places (numeric 8,7)", () => {
    expect(POSITION_DECIMALS).toBe(7);
    expect(roundPosition(0.123456789)).toBe(0.1234568);
  });

  it("round-trips top-left and bottom-right without swapping x/y", () => {
    const width = 8000;
    const height = 6000;
    const topLeft = relativeToLatLng(0, 0, width, height);
    expect(latLngToRelative(topLeft.lat, topLeft.lng, width, height)).toEqual({
      x: 0,
      y: 0,
    });
    const bottomRight = relativeToLatLng(1, 1, width, height);
    expect(latLngToRelative(bottomRight.lat, bottomRight.lng, width, height)).toEqual({ x: 1, y: 1 });
  });

  it("maps image y=0 to the top of CRS.Simple bounds", () => {
    const width = 100;
    const height = 200;
    const top = relativeToLatLng(0.5, 0, width, height);
    expect(top.lat).toBe(height);
    expect(top.lng).toBe(50);
    const bottom = relativeToLatLng(0.5, 1, width, height);
    expect(bottom.lat).toBe(0);
  });

  it("uses [south-west, north-east] bounds as [y,x] pairs", () => {
    expect(imageOverlayBounds(8000, 6000)).toEqual([
      [0, 0],
      [6000, 8000],
    ]);
  });
});
