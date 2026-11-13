import assert from "node:assert/strict";
import { test } from "node:test";
import { Vector3 } from "three";
import { smoothPosition } from "../src/lib/motion.js";

test("visual motion approaches the authoritative position independently of frame rate", () => {
  const target = new Vector3(4, 2, -3);
  const slowFrames = new Vector3();
  const fastFrames = new Vector3();
  smoothPosition(slowFrames, target, 1 / 30);
  const firstFrameX = slowFrames.x;
  assert.ok(firstFrameX > 0 && firstFrameX < target.x);
  smoothPosition(slowFrames, target, 1 / 30);
  assert.ok(slowFrames.x > firstFrameX);
  for (let i = 2; i < 15; i++) smoothPosition(slowFrames, target, 1 / 30);
  for (let i = 0; i < 60; i++) smoothPosition(fastFrames, target, 1 / 120);
  assert.ok(slowFrames.distanceTo(fastFrames) < 1e-10);
  assert.ok(slowFrames.distanceTo(target) < 0.01);
  assert.ok(slowFrames.x > 0 && slowFrames.x < target.x);
});
