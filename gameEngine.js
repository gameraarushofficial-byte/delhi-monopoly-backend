const { tiles, GO_BONUS } = require("./boardData");
const { rollDice } = require("./utils");

class GameEngine {
  constructor() {
    this.players = [];
    this.turnIndex = 0;
  }

  addPlayer(player) {
    if (this.players.length >= 6) return false;
    this.players.push(player);
    return true;
  }

  currentPlayer() {
    return this.players[this.turnIndex];
  }

  nextTurn() {
    this.turnIndex = (this.turnIndex + 1) % this.players.length;
  }

  roll(playerId) {
    const player = this.currentPlayer();
    if (player.id !== playerId) throw "NOT_YOUR_TURN";

    const dice = rollDice();
    const steps = dice[0] + dice[1];

    let oldPos = player.position;
    player.position = (player.position + steps) % tiles.length;

    if (player.position < oldPos) {
      player.money += GO_BONUS;
    }

    return { dice, tile: tiles[player.position] };
  }
}

module.exports = GameEngine;

