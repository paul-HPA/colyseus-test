import { Room } from "@colyseus/core";
import { GameState } from "../schema/GameState.js";
import { Player } from "../schema/Player.js";

const WORLD_SIZE = 20;
const PLAYER_SPEED = 0.2;
const GRAVITY = -0.025;
const JUMP_FORCE = 0.25;
const INPUT_KEYS = ["forward", "backward", "left", "right", "jump"];

class GameRoom extends Room {
  state = new GameState();
  playerInputs = new Map();
  jumpVelocities = new Map();
  npcTargets = {};

  messages = {
    move: (client, input) => {
      if (!input || typeof input !== "object" ||
          !INPUT_KEYS.every((key) => typeof input[key] === "boolean")) {
        console.warn(`Invalid movement input from ${client.sessionId}`);
        return;
      }
      const previous = this.playerInputs.get(client.sessionId);
      if (!previous) return;
      this.playerInputs.set(client.sessionId, {
        ...input,
        jumpQueued: previous.jumpQueued || (input.jump && !previous.jump),
      });
    },
  };

  onCreate() {
    this.setTimestep(() => this.update(), 50);

    for (let i = 0; i < 3; i++) {
      this.spawnNPC(i);
    }
  }

  onJoin(client) {
    const player = new Player();
    player.id = client.sessionId;
    this.placePlayer(player);
    this.state.players.set(client.sessionId, player);
    this.playerInputs.set(client.sessionId, {
      forward: false, backward: false, left: false, right: false, jump: false, jumpQueued: false,
    });
    console.log(`Client joined: ${client.sessionId}`);
  }

  onLeave(client) {
    this.state.players.delete(client.sessionId);
    this.playerInputs.delete(client.sessionId);
    this.jumpVelocities.delete(client.sessionId);
  }

  spawnNPC(id) {
    const npc = new Player();
    npc.id = `npc_${id}`;
    npc.isNPC = true;
    this.placePlayer(npc);

    const npcId = npc.id;
    this.state.players.set(npcId, npc);

    this.npcTargets[npcId] = {
      x: Math.random() * WORLD_SIZE - WORLD_SIZE/2, 
      z: Math.random() * WORLD_SIZE - WORLD_SIZE/2,
      timer: Math.random() * 100
    };
  }

  placePlayer(player) {
    const limit = WORLD_SIZE / 2 - player.radius;
    for (let i = 0; i < 100; i++) {
      const x = Math.random() * limit * 2 - limit;
      const z = Math.random() * limit * 2 - limit;
      if (!this.checkCollision(player, x, z)) {
        player.x = x;
        player.y = player.radius;
        player.z = z;
        return;
      }
    }

    for (let x = -limit; x <= limit; x += player.radius) {
      for (let z = -limit; z <= limit; z += player.radius) {
        if (!this.checkCollision(player, x, z)) {
          player.x = x;
          player.y = player.radius;
          player.z = z;
          return;
        }
      }
    }
    throw new Error("No free space to spawn an avatar");
  }

  move(player, input) {
    let dx = 0;
    let dz = 0;

    if (input.forward) dz -= PLAYER_SPEED;
    if (input.backward) dz += PLAYER_SPEED;
    if (input.left) dx -= PLAYER_SPEED;
    if (input.right) dx += PLAYER_SPEED;

    if (dx && dz) {
      dx /= Math.SQRT2;
      dz /= Math.SQRT2;
    }

    this.applyMovement(player, dx, dz);

    let velocity = this.jumpVelocities.get(player.id) || 0;
    if (input.jumpQueued && player.y <= player.radius) {
      velocity = JUMP_FORCE;
    }
    input.jumpQueued = false;
    if (player.y > player.radius || velocity > 0) {
      player.y = Math.max(player.radius, player.y + velocity);
      velocity += GRAVITY;
      if (player.y === player.radius) velocity = 0;
    }
    this.jumpVelocities.set(player.id, velocity);
  }

  applyMovement(player, dx, dz) {
    const limit = WORLD_SIZE / 2 - player.radius;
    const nextX = Math.max(-limit, Math.min(limit, player.x + dx));
    const nextZ = Math.max(-limit, Math.min(limit, player.z + dz));

    if (!this.checkCollision(player, nextX, player.z)) player.x = nextX;
    if (!this.checkCollision(player, player.x, nextZ)) player.z = nextZ;
  }

  checkCollision(player, nx, nz) {
    for (const [id, other] of this.state.players) {
      if (id === player.id) continue;

      const distSq = Math.pow(nx - other.x, 2) + Math.pow(nz - other.z, 2);
      const minDist = player.radius + other.radius;
      if (distSq < minDist * minDist) return true;
    }
    return false;
  }

  update() {
    for (const [id, player] of this.state.players) {
      if (!player.isNPC) {
        const input = this.playerInputs.get(id);
        if (input) this.move(player, input);
        continue;
      }

      const target = this.npcTargets[id];
      if (!target) continue;

      target.timer--;
      if (target.timer <= 0) {
        target.x = Math.random() * WORLD_SIZE - WORLD_SIZE/2;
        target.z = Math.random() * WORLD_SIZE - WORLD_SIZE/2;
        target.timer = 200 + Math.random() * 300;
      }

      const dx = target.x - player.x;
      const dz = target.z - player.z;
      const dist = Math.sqrt(dx*dx + dz*dz);
      
      if (dist > 0.1) {
        const vx = (dx / dist) * 0.05;
        const vz = (dz / dist) * 0.05;
        this.applyMovement(player, vx, vz);
      }
    }
  }
}

export { GameRoom };
