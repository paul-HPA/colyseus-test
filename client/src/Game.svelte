<script>
  import { onMount } from 'svelte';
  import * as THREE from 'three';
  import { Callbacks, Client } from '@colyseus/sdk';
  import { smoothPosition } from './lib/motion.js';

  let canvasElement;
  const serverUrl = import.meta.env.VITE_COLYSEUS_URL ||
    `${window.location.protocol}//${window.location.hostname}:2567`;
  const client = new Client(serverUrl);
  let room;
  let connectionStatus = 'Connecting...';

  const players = new Map(); // Map of sessionId -> THREE.Mesh
  let scene, camera, renderer;
  let myId = null;

  const keyControls = {
    KeyW: 'forward', ArrowUp: 'forward',
    KeyS: 'backward', ArrowDown: 'backward',
    KeyA: 'left', ArrowLeft: 'left',
    KeyD: 'right', ArrowRight: 'right',
    Space: 'jump'
  };
  const buttons = [
    { control: 'forward', label: 'Move forward', text: '↑' },
    { control: 'left', label: 'Move left', text: '←' },
    { control: 'backward', label: 'Move backward', text: '↓' },
    { control: 'right', label: 'Move right', text: '→' },
    { control: 'jump', label: 'Jump', text: 'Jump' }
  ];
  const heldKeys = new Set();
  const heldButtons = new Set();
  const pointers = new Map();

  function sendInput() {
    if (!room) return;
    const active = new Set([...heldKeys].map((key) => keyControls[key]));
    for (const control of heldButtons) active.add(control);
    for (const control of pointers.values()) active.add(control);
    room.send('move', {
      forward: active.has('forward'),
      backward: active.has('backward'),
      left: active.has('left'),
      right: active.has('right'),
      jump: active.has('jump')
    });
  }

  function pressControl(event, control) {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    pointers.set(event.pointerId, control);
    sendInput();
  }

  function releaseControl(event) {
    if (pointers.delete(event.pointerId)) sendInput();
  }

  function buttonKey(event, control, pressed) {
    if (event.code !== 'Space' && event.code !== 'Enter') return;
    event.preventDefault();
    event.stopPropagation();
    if (pressed) heldButtons.add(control);
    else heldButtons.delete(control);
    sendInput();
  }

  function releaseButton(control) {
    if (heldButtons.delete(control)) sendInput();
  }

  onMount(() => {
    let disposed = false;
    let animationFrame;
    let lastFrameTime;
    const targetPosition = new THREE.Vector3();
    const cameraTarget = new THREE.Vector3();

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
    const floorGeo = new THREE.PlaneGeometry(20, 20);
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x228b22 });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    scene.add(floor);

    // Boundaries (Visual only, server handles physics)
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x808080, transparent: true, opacity: 0.3 });
    const wallGeo = new THREE.BoxGeometry(20, 2, 1);
    
    const wallN = new THREE.Mesh(wallGeo, wallMat); wallN.position.set(0, 1, -10.5); scene.add(wallN);
    const wallS = new THREE.Mesh(wallGeo, wallMat); wallS.position.set(0, 1, 10.5); scene.add(wallS);
    const wallE = new THREE.Mesh(wallGeo, wallMat); wallE.position.set(10.5, 1, 0); wallE.rotation.y = Math.PI/2; scene.add(wallE);
    const wallW = new THREE.Mesh(wallGeo, wallMat); wallW.position.set(-10.5, 1, 0); wallW.rotation.y = Math.PI/2; scene.add(wallW);

    async function connect() {
      try {
        const joined = await client.joinOrCreate("game", {});
        if (disposed) {
          await joined.leave();
          return;
        }
        room = joined;
        myId = room.sessionId;
        connectionStatus = 'Connected';
        sendInput();
        console.log("Joined room: " + myId);

        const callbacks = Callbacks.get(room);
        callbacks.onAdd("players", (player, sessionId) => {
          console.log("Player joined:", sessionId);
          const sphere = new THREE.Mesh(
            new THREE.SphereGeometry(player.radius, 16, 16),
            new THREE.MeshStandardMaterial({ color: player.isNPC ? 0xff0000 : 0x00ff00 })
          );
          sphere.position.set(player.x, player.y, player.z);
          scene.add(sphere);
          players.set(sessionId, sphere);
        });

        callbacks.onRemove("players", (player, sessionId) => {
          console.log("Player left:", sessionId);
          const sphere = players.get(sessionId);
          if (sphere) {
            scene.remove(sphere);
            sphere.geometry.dispose();
            sphere.material.dispose();
            players.delete(sessionId);
          }
        });

        room.onLeave((code) => {
          console.warn("Disconnected from room:", code);
          for (const sphere of players.values()) {
            scene.remove(sphere);
            sphere.geometry.dispose();
            sphere.material.dispose();
          }
          players.clear();
          room = undefined;
          if (!disposed) connectionStatus = 'Disconnected. Reload to reconnect.';
        });
      } catch (e) {
        console.error("Join error:", e);
        if (!disposed) connectionStatus = 'Unable to connect. Check the server and reload.';
      }
    }
    connect();

    const onKeyDown = (event) => {
      if (!keyControls[event.code]) return;
      event.preventDefault();
      if (!heldKeys.has(event.code)) {
        heldKeys.add(event.code);
        sendInput();
      }
    };
    const onKeyUp = (event) => {
      if (!keyControls[event.code]) return;
      event.preventDefault();
      if (heldKeys.delete(event.code)) sendInput();
    };
    const onBlur = () => {
      heldKeys.clear();
      heldButtons.clear();
      pointers.clear();
      sendInput();
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    const inputInterval = setInterval(() => {
      if (heldKeys.size || heldButtons.size || pointers.size) sendInput();
    }, 50);

    // Render loop
    const animate = (time) => {
      animationFrame = requestAnimationFrame(animate);
      const elapsedSeconds = lastFrameTime === undefined ? 0 : Math.min((time - lastFrameTime) / 1000, 0.1);
      lastFrameTime = time;

      if (room) {
        // Sync ThreeJS positions with Colyseus state
        room.state?.players?.forEach((player, sessionId) => {
          const mesh = players.get(sessionId);
          if (mesh) {
            targetPosition.set(player.x, player.y, player.z);
            smoothPosition(mesh.position, targetPosition, elapsedSeconds);
            
            if (sessionId === myId) {
              cameraTarget.set(mesh.position.x, mesh.position.y + 10, mesh.position.z + 15);
              camera.position.lerp(cameraTarget, 1 - Math.exp(-elapsedSeconds / 0.15));
              camera.lookAt(mesh.position);
            }
          }
        });
      }

      renderer.render(scene, camera);
    };

    animationFrame = requestAnimationFrame(animate);

    const onResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', onResize);

    return () => {
      disposed = true;
      cancelAnimationFrame(animationFrame);
      clearInterval(inputInterval);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('resize', onResize);
      if (room) room.leave().catch((error) => console.error('Leave error:', error));
      scene.traverse((object) => {
        if (object.isMesh) {
          object.geometry.dispose();
          object.material.dispose();
        }
      });
      renderer.dispose();
    };
  });
</script>

<canvas bind:this={canvasElement}></canvas>
<div class="hud">
  <p class="status" role="status">{connectionStatus}</p>
  <p>Move: WASD or arrow keys · Jump: Space</p>
  <div class="controls" aria-label="Game controls">
    {#each buttons as button}
      <button
        class={button.control}
        type="button"
        aria-label={button.label}
        on:pointerdown={(event) => pressControl(event, button.control)}
        on:pointerup={releaseControl}
        on:pointercancel={releaseControl}
        on:lostpointercapture={releaseControl}
        on:keydown={(event) => buttonKey(event, button.control, true)}
        on:keyup={(event) => buttonKey(event, button.control, false)}
        on:blur={() => releaseButton(button.control)}
      >{button.text}</button>
    {/each}
  </div>
</div>

<style>
  canvas {
    width: 100%;
    height: 100%;
    display: block;
  }

  .hud {
    position: fixed;
    top: 1rem;
    left: 1rem;
    padding: 0.75rem;
    border-radius: 0.5rem;
    background: rgba(0, 0, 0, 0.75);
    color: white;
    text-align: left;
    font-size: 0.85rem;
  }

  .status {
    font-weight: bold;
    margin-bottom: 0.25rem;
  }

  .controls {
    display: grid;
    grid-template-columns: repeat(3, 3rem);
    gap: 0.3rem;
    margin-top: 0.6rem;
  }

  button {
    min-height: 2.75rem;
    border: 1px solid #fff;
    border-radius: 0.35rem;
    background: #333;
    color: white;
    font: inherit;
    cursor: pointer;
    touch-action: none;
    user-select: none;
  }

  button:active {
    background: #666;
  }

  .forward { grid-column: 2; }
  .left { grid-column: 1; grid-row: 2; }
  .backward { grid-column: 2; grid-row: 2; }
  .right { grid-column: 3; grid-row: 2; }
  .jump { grid-column: 1 / 4; }
</style>
