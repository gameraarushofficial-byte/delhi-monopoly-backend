const crypto = require("crypto");

module.exports = {
  uuid() {
    return crypto.randomUUID();
  },

  rollDice() {
    return [
      Math.floor(Math.random() * 6) + 1,
      Math.floor(Math.random() * 6) + 1
    ];
  }
};

