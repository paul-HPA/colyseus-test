import { pathToFileURL } from "node:url";
import { defineServer, defineRoom } from "@colyseus/core";
import { GameRoom } from "./rooms/GameRoom.js";

function createGameServer(options = {}) {
  return defineServer({
    ...options,
    rooms: {
      game: defineRoom(GameRoom),
    },
    express: (app) => {
      app.get("/", (req, res) => {
        res.send("Colyseus Server is running!");
      });
    },
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const gameServer = createGameServer();
  gameServer.listen(2567).then(() => {
    console.log("Listening on http://localhost:2567");
  }).catch((error) => {
    console.error("Failed to start Colyseus server:", error);
    process.exitCode = 1;
  });
}

export { createGameServer };
