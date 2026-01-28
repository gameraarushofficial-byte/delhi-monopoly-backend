const WebSocket = require("ws");
const GameEngine = require("./gameEngine");
const { uuid } = require("./utils");

const wss = new WebSocket.Server({ port: process.env.PORT || 8080 });
const game = new GameEngine();

wss.on("connection", ws => {
  ws.on("message", msg => {
    const data = JSON.parse(msg);

    if (data.type === "JOIN") {
      const player = {
        id: uuid(),
        name: data.name,
        money: 15000,
        position: 0,
        inJail: false
      };
      game.addPlayer(player);
      ws.playerId = player.id;

      ws.send(JSON.stringify({ type: "JOINED", player }));
    }

    if (data.type === "ROLL") {
      try {
        const result = game.roll(ws.playerId);
        broadcast({ type: "ROLL_RESULT", result });
      } catch (e) {
        ws.send(JSON.stringify({ type: "ERROR", message: e }));
      }
    }
  });
});

function broadcast(data) {
  wss.clients.forEach(c => {
    if (c.readyState === WebSocket.OPEN) {
      c.send(JSON.stringify(data));
    }
  });
}
