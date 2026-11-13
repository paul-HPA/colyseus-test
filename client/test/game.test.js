import assert from "node:assert/strict";
import { test } from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { Callbacks, Client } from "@colyseus/sdk";
import { createGameServer } from "../../server/index.js";

async function waitFor(condition, message) {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    if (condition()) return;
    await delay(10);
  }
  assert.fail(message);
}

test("clients join, synchronize movement, and observe players leaving", { timeout: 15000 }, async (t) => {
  const gameServer = createGameServer({ gracefullyShutdown: false, greet: false });
  await gameServer.listen(0);
  t.after(() => gameServer.gracefullyShutdown(false));
  const port = gameServer.transport.server.address().port;
  const response = await fetch(`http://localhost:${port}/`);
  assert.equal(await response.text(), "Colyseus Server is running!");

  const client = new Client(`http://localhost:${port}`);
  const first = await client.joinOrCreate("game");
  const added = new Map();
  const removed = new Set();
  const callbacks = Callbacks.get(first);
  callbacks.onAdd("players", (player, id) => added.set(id, player.radius));
  callbacks.onRemove("players", (player, id) => removed.add(id));
  await waitFor(() => first.state?.players?.size === 4 && added.size === 4, "initial state was not synchronized");
  assert.equal(added.size, 4);
  assert.ok([...added.values()].every((radius) => radius === 1));
  assert.equal(first.state.players.get(first.sessionId).radius, 1);
  assert.equal([...first.state.players.values()].filter((player) => player.isNPC).length, 3);

  const second = await client.joinOrCreate("game");
  assert.equal(second.roomId, first.roomId);
  await waitFor(() => added.has(second.sessionId), "second player was not added");
  await waitFor(() => second.state?.players?.has(second.sessionId), "second player's state was not synchronized");

  const secondPlayer = second.state.players.get(second.sessionId);
  const initialX = secondPlayer.x;
  const initialZ = secondPlayer.z;
  const obstacles = [...second.state.players.values()].filter((player) => player.id !== second.sessionId);
  const directions = [
    { key: "left", dx: -0.2, dz: 0 },
    { key: "right", dx: 0.2, dz: 0 },
    { key: "forward", dx: 0, dz: -0.2 },
    { key: "backward", dx: 0, dz: 0.2 },
  ];
  const direction = directions.find(({ dx, dz }) =>
    Math.abs(initialX + dx) <= 9 && Math.abs(initialZ + dz) <= 9 &&
    obstacles.every((player) => Math.hypot(initialX + dx - player.x, initialZ + dz - player.z) >= 2.2)
  );
  assert.ok(direction, "no free direction for movement test");
  const neutral = { forward: false, backward: false, left: false, right: false, jump: false };
  second.send("move", { ...neutral, [direction.key]: true });
  await waitFor(
    () => Math.hypot(secondPlayer.x - initialX, secondPlayer.z - initialZ) > 0.1,
    "held movement was not synchronized"
  );
  second.send("move", neutral);
  await delay(200);
  const stoppedX = secondPlayer.x;
  const stoppedZ = secondPlayer.z;
  await delay(200);
  assert.equal(secondPlayer.x, stoppedX, "player did not stop after releasing movement");
  assert.equal(secondPlayer.z, stoppedZ, "player did not stop after releasing movement");

  second.send("move", null);
  second.send("move", { ...neutral, jump: true });
  second.send("move", neutral);
  await waitFor(() => first.state.players.get(second.sessionId)?.y > 1, "movement was not synchronized");

  await second.leave();
  await waitFor(() => removed.has(second.sessionId), "player removal was not synchronized");
  assert.equal(first.state.players.has(second.sessionId), false);
  await first.leave();
});
