import assert from "node:assert/strict";
import { test } from "node:test";
import { GameRoom } from "../../server/rooms/GameRoom.js";
import { Player } from "../../server/schema/Player.js";

test("NPCs and players spawn without overlapping even when random positions collide", () => {
  const room = new GameRoom();
  const random = Math.random;
  Math.random = () => 0.5;
  try {
    for (let i = 0; i < 3; i++) room.spawnNPC(i);
    for (let i = 0; i < 8; i++) room.onJoin({ sessionId: `player_${i}` });
  } finally {
    Math.random = random;
  }

  const players = [...room.state.players.values()];
  for (let i = 0; i < players.length; i++) {
    const player = players[i];
    assert.ok(Math.abs(player.x) + player.radius <= 10);
    assert.ok(Math.abs(player.z) + player.radius <= 10);
    for (const other of players.slice(i + 1)) {
      assert.ok(Math.hypot(player.x - other.x, player.z - other.z) >= player.radius + other.radius);
    }
  }
});

test("movement respects avatar colliders and visible world bounds", () => {
  const room = new GameRoom();
  const player = new Player();
  player.id = "player";
  player.y = 1;
  const obstacle = new Player();
  obstacle.id = "obstacle";
  obstacle.x = 2;
  obstacle.y = 1;
  room.state.players.set(player.id, player);
  room.state.players.set(obstacle.id, obstacle);

  room.applyMovement(player, 0.2, 0.2);
  assert.equal(player.x, 0);
  assert.equal(player.z, 0.2);
  assert.ok(Math.hypot(player.x - obstacle.x, player.z - obstacle.z) >= 2);

  player.x = 8.95;
  player.z = 8.95;
  room.applyMovement(player, 0.2, 0.2);
  assert.equal(player.x, 9);
  assert.equal(player.z, 9);
});

test("one held input continues moving on every tick until released", () => {
  const room = new GameRoom();
  room.onJoin({ sessionId: "player" });
  const player = room.state.players.get("player");
  player.x = 0;
  player.z = 0;
  const client = { sessionId: "player" };
  const input = { forward: false, backward: false, left: false, right: true, jump: false };
  room.messages.move(client, input);
  for (let i = 0; i < 10; i++) {
    const previousX = player.x;
    room.update();
    assert.ok(player.x > previousX);
  }
  assert.ok(player.x > 1.9);
  room.messages.move(client, { ...input, right: false });
  const stoppedX = player.x;
  for (let i = 0; i < 5; i++) room.update();
  assert.equal(player.x, stoppedX);
});

test("jumping rises and lands without repeated jump input", () => {
  const room = new GameRoom();
  room.onJoin({ sessionId: "player" });
  const player = room.state.players.get("player");
  const input = room.playerInputs.get("player");
  input.jumpQueued = true;
  room.update();
  assert.ok(player.y > player.radius);
  for (let i = 0; i < 50; i++) room.update();
  assert.equal(player.y, player.radius);
  room.onLeave({ sessionId: "player" });
  assert.equal(room.playerInputs.has("player"), false);
  assert.equal(room.jumpVelocities.has("player"), false);
});
