const { Room,} = require("colyseus");
const { GameState } = require("../schema/GameState");
const { Player } = require("../schema/Player");

const WORLD_SIZE = 20;
const PLAYER_SPEED = 0.2;
const GRAVITY = -0.01;
const JUMP_FORCE = 0.2;

class GameRoom extends Room {
  onCreate() {
    this.setState(new GameState());

    // Server tick for physics and NPCs
    this.setSimulationInterval((serverTime) => this.update(serverTime), 50);
    
    // Spawn some NPCs
    for (let i = 0; i < 3; i++) {
      this.spawnNPC(i);
    }

    this.onMessage("move", (client, input) => {
      this.move(client.sessionId, input);
    });
  }

  onJoin(client, options) {
    console.log(`Client joined: ${client.sessionId}`);
    
    const player = new Player();
    player.id = client.sessionId;
    player.x = Math.random() * 10 - 5;
    player.z = Math.random() * 10 - 5;
    player.y = 1;
    
    this.state.players.set(client.sessionId, player);
  }



  onLeave(client, consented) {
    this.state.players.delete(client.sessionId);
  }

  spawnNPC(id) {
    const npc = new Player();
    npc.id = `npc_${id}`;
    npc.isNPC = true;
    npc.x = Math.random() * WORLD_SIZE - WORLD_SIZE/2;
    npc.z = Math.random() * WORLD_SIZE - WORLD_SIZE/2;
    npc.y = 1;
    
    const npcId = npc.id;
    this.state.players.set(npcId, npc);
    
    // Store NPC target for simple movement
    if (!this.npcTargets) this.npcTargets = {};
    this.npcTargets[npcId] = { 
      x: Math.random() * WORLD_SIZE - WORLD_SIZE/2, 
      z: Math.random() * WORLD_SIZE - WORLD_SIZE/2,
      timer: Math.random() * 100
    };
  }

  // Movement input from client
  move(sessionId, input) {
    const player = this.state.players.get(sessionId);
    if (!player || player.isNPC) return;

    let dx = 0;
    let dz = 0;

    if (input.forward) dz -= PLAYER_SPEED;
    if (input.backward) dz += PLAYER_SPEED;
    if (input.left) dx -= PLAYER_SPEED;
    if (input.right) dx += PLAYER_SPEED;

    if (input.jump && player.y <= 1.01) {
       player.y += JUMP_FORCE;
    }

    this.applyMovement(player, dx, dz);
  }

  applyMovement(player, dx, dz) {
    const nextX = player.x + dx;
    const nextZ = player.z + dz;

    if (this.checkCollision(player, nextX, player.y, nextZ)) {
      // Simple collision response: stop
    } else {
      player.x = nextX;
      player.z = nextZ;
    }

    // Gravity
    if (player.y > 1) {
      player.y += GRAVITY;
    } else {
      player.y = 1;
    }

    // Boundary check
    player.x = Math.max(-WORLD_SIZE/2, Math.min(WORLD_SIZE/2, player.x));
    player.z = Math.max(-WORLD_SIZE/2, Math.min(WORLD_SIZE/2, player.z));
  }

  checkCollision(player, nx, ny, nz) {
    for (let [id, other] of this.state.players) {
      if (id === player.id) continue;
      
      // Simplified distance check for spheres
      const distSq = Math.pow(nx - other.x, 2) + Math.pow(nz - other.z, 2);
      const minDist = player.radius + other.radius;
      if (distSq < minDist * minDist) return true;
    }
    return false;
  }

  update(serverTime) {
    // Update NPCs
    for (let [id, player] of this.state.players) {
      if (!player.isNPC) continue;

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

module.exports = { GameRoom };
