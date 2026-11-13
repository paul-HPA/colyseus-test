const { Schema, MapSchema } = require("@colyseus/schema");
const { Player } = require("./Player");

class GameState extends Schema {
  @MapSchema({ type: Player }) players = new Map();
}

module.exports = { GameState };
