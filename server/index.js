const Colyseus = require("colyseus");
const express = require("express");
const http = require("http");
const { GameRoom } = require("./rooms/GameRoom");

const app = express();
const server = http.createServer(app);
const gameServer = new Colyseus.Server();

gameServer.define("game", GameRoom);
gameServer.listen(server);

app.get("/", (req, res) => {
  res.send("Colyseus Server is running!");
});

server.listen(2567, () => {
  console.log("Listening on http://localhost:2567");
});
