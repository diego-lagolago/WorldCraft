import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  POSITION_DECIMALS,
  imageOverlayBounds,
  latLngToRelative,
  relativeToLatLng,
  roundPosition,
} from "./coords.ts";

describe("spike karte coords", () => {
  it("keeps at least 6 decimal places (numeric 8,7)", () => {
    assert.equal(POSITION_DECIMALS, 7);
    assert.equal(roundPosition(0.123456789), 0.1234568);
  });

  it("round-trips top-left and bottom-right without swapping x/y", () => {
    const width = 8000;
    const height = 6000;
    const topLeft = relativeToLatLng(0, 0, width, height);
    assert.deepEqual(latLngToRelative(topLeft.lat, topLeft.lng, width, height), {
      x: 0,
      y: 0,
    });
    const bottomRight = relativeToLatLng(1, 1, width, height);
    assert.deepEqual(
      latLngToRelative(bottomRight.lat, bottomRight.lng, width, height),
      { x: 1, y: 1 },
    );
  });

  it("maps image y=0 to the top of CRS.Simple bounds", () => {
    const width = 100;
    const height = 200;
    const top = relativeToLatLng(0.5, 0, width, height);
    assert.equal(top.lat, height);
    assert.equal(top.lng, 50);
    const bottom = relativeToLatLng(0.5, 1, width, height);
    assert.equal(bottom.lat, 0);
  });

  it("uses [south-west, north-east] bounds as [y,x] pairs", () => {
    assert.deepEqual(imageOverlayBounds(8000, 6000), [
      [0, 0],
      [6000, 8000],
    ]);
  });
});
