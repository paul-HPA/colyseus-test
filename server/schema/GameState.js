import { schema, t } from "@colyseus/schema";
import { Player } from "./Player.js";

const GameState = schema({
  players: t.map(Player),
}, "GameState");

export { GameState };
