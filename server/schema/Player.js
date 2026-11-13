import { schema, t } from "@colyseus/schema";

const Player = schema({
  id: t.string().default(""),
  x: t.number().default(0),
  y: t.number().default(0),
  z: t.number().default(0),
  radius: t.number().default(1),
  isNPC: t.boolean().default(false),
}, "Player");

export { Player };
