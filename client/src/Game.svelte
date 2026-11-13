<script>
  import { onMount } from 'svelte';
  import * as THREE from 'three';
  import { Client } from '@colyseus/sdk';

  let canvasElement;
  let client = new Client();
  let room;
  
  const players = new Map(); // Map of sessionId -> THREE.Mesh
  let scene, camera, renderer, clock;
  let myId = null;

  const keys = {
    forward: false,
    backward: false,
    left: false,
    false: false, // Wait, right
    right: false,
    jump: false
  };

  onMount(async () => {
    // --- ThreeJS Setup ---
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87ceeb);

    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 10, 15);
    camera.lookAt(0, 0, 0);

    renderer = new THREE.WebGLRenderer({ canvas: canvasElement, antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xffffff, 1);
    sunLight.position.set(5, 10, 7.5);
    scene.add(sunLight);

    // Floor
    const floorGeo = new THREE.PlaneGeometry(40, 40);
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x228b22 });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    scene.add(floor);

    // Boundaries (Visual only, server handles physics)
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x808080, transparent: true, opacity: 0.3 });
    const wallGeo = new THREE.BoxGeometry(40, 2, 1);
    
    const wallN = new THREE.Mesh(wallGeo, wallMat); wallN.position.set(0, 1, -20); scene.add(wallN);
    const wallS = new THREE.Mesh(wallGeo, wallMat); wallS.position.set(0, 1, 20); scene.add(wallS);
    const wallE = new THREE.Mesh(wallGeo, wallMat); wallE.position.set(20, 1, 0); wallE.rotation.y = Math.PI/2; scene.add(wallE);
    const wallW = new THREE.Mesh(wallGeo, wallMat); wallW.position.set(-20, 1, 0); wallW.rotation.y = Math.PI/2; scene.add(wallW);

    clock = new THREE.Clock();

    // --- Colyseus Setup ---
    try {
      room = await client.join("game", {});
      myId = room.sessionId;
      console.log("Joined room: " + myId);

      room.state.players.onAdd = (player, sessionId) => {
        console.log("Player joined:", sessionId);
        const sphere = new THREE.Mesh(
          new THREE.SphereGeometry(player.radius, 16, 16),
          new THREE.MeshStandardMaterial({ color: player.isNPC ? 0xff0000 : 0x00ff00 })
        );
        scene.add(sphere);
        players.set(sessionId, sphere);
      };

      room.state.players.onRemove = (player, sessionId) => {
        console.log("Player left:", sessionId);
        const sphere = players.get(sessionId);
        if (sphere) {
          scene.remove(sphere);
          players.delete(sessionId);
        }
      };
    } catch (e) {
      console.error("Join error:", e);
    }

    // Input handlers
    window.addEventListener('keydown', (e) => {
      if (e.code === 'KeyW') keys.forward = true;
      if (e.code === 'KeyS') keys.backward = true;
      if (e.code === 'KeyA') keys.left = true;
      if (e.code === 'KeyD') keys.right = true;
      if (e.code === 'Space') keys.jump = true;
    });
    window.addEventListener('keyup', (e) => {
      if (e.code === 'KeyW') keys.forward = false;
      if (e.code === 'KeyS') keys.backward = false;
      if (e.code === 'KeyA') keys.left = false;
      if (e.code === 'KeyD') keys.right = false;
      if (e.code === 'Space') keys.jump = false;
    });

    // Render loop
    const animate = () => {
      requestAnimationFrame(animate);

      // Send inputs to server
      if (room) {
        room.send("move", {
          forward: keys.forward,
          backward: keys.backward,
          left: keys.left,
          right: keys.right,
          jump: keys.jump
        });

        // Sync ThreeJS positions with Colyseus state
        room.state.players.forEach((player, sessionId) => {
          const mesh = players.get(sessionId);
          if (mesh) {
            mesh.position.set(player.x, player.y, player.z);
            
            if (sessionId === myId) {
               // Follow player with camera
               camera.position.lerp(new THREE.Vector3(player.x, player.y + 10, player.z + 15), 0.1);
               camera.lookAt(player.x, player.y, player.z);
            }
          }
        });
      }

      renderer.render(scene, camera);
    };

    animate();

    window.addEventListener('resize', () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    });
  });
</script>

<canvas bind:this={canvasElement}></canvas>

<style>
  canvas {
    width: 100%;
    height: 100%;
    display: block;
  }
</style>
