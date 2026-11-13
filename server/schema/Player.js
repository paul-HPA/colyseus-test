const { Schema, type } = require("@colyseus/schema");

class Player extends Schema {
  @type({ type: "string", value: "" }) id = "";
  @type({ type: "number", value: 0 }) x = 0;
  @type({ type: "number", value: 0 }) y = 0;
  @type({ type: "number", value: 0 }) z = 0;
  @type({ type: "number", value: 1 }) radius = 1;
  @type({ type: "boolean", value: false }) isNPC = false;
}

module.exports = { Player };
