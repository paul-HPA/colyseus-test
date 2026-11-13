# Colyseus test game

Requires Node.js 22 or newer. Install and start the server and client in
separate terminals:

```sh
cd server
npm ci
npm start
```

```sh
cd client
npm ci
npm run dev
```

The client connects to port 2567 on the page's host by default. Set
`VITE_COLYSEUS_URL` before starting Vite to use a different server URL, for
example `VITE_COLYSEUS_URL=http://localhost:2567 npm run dev`.

Use WASD or the arrow keys to move and Space to jump. The on-screen buttons
also support mouse, touch, and keyboard input. Your avatar is green; NPCs are
red. Movement and collisions are handled by the server.

After installing both projects, run `npm test` in `client/` for the
client-server synchronization test.
