import WebSocket, { WebSocketServer } from "ws";
import http from "http";

const server = http.createServer();
const wss = new WebSocketServer({ server });

/* =========================
   GLOBAL GAME STATE
========================= */
const gameState = {
  players: {},          // socketId -> player
  order: [],            // turn order
  currentTurn: 0,
  started: false,
  board: [],            // 40 tiles
};

/* =========================
   INIT BOARD (ONCE)
========================= */
function initBoard() {
  if (gameState.board.length) return;

  const names = [
    "GO","Connaught Place","Chance","Karol Bagh","Income Tax",
    "New Delhi Station","Rajendra Place","Chance","Patel Nagar","Jail",
    "Rajouri Garden","Electric Company","Janakpuri","Tilak Nagar","DTDC",
    "Punjabi Bagh","Chance","Pitampura","Luxury Tax","Free Parking",
    "Rohini","Chance","Model Town","Water Works","Civil Lines",
    "Kashmere Gate","Vasant Kunj","Chance","Saket","Go To Jail",
    "Greater Kailash","Dwarka","Chance","Noida","DTDC",
    "Gurgaon","Chance","Faridabad","Super Tax"
  ];

  names.forEach((name, i) => {
    gameState.board.push({
      id: i,
      name,
      price: name.includes("Chance") || name.includes("Tax") || name.includes("Jail") || name === "GO"
        ? 0
        : 1200 + (i * 80),
      owner: null,
      mortgaged: false,
      houses: 0,
      hotel: false
    });
  });
}

initBoard();

/* =========================
   HELPERS
========================= */
function broadcast(data) {
  const msg = JSON.stringify(data);
  wss.clients.forEach(c => {
    if (c.readyState === WebSocket.OPEN) c.send(msg);
  });
}

function currentPlayer() {
  return gameState.players[gameState.order[gameState.currentTurn]];
}

/* =========================
   WEBSOCKET
========================= */
wss.on("connection", ws => {
  ws.id = crypto.randomUUID();

  ws.on("message", raw => {
    const msg = JSON.parse(raw);

    /* JOIN */
    if (msg.type === "JOIN") {
      if (gameState.players[ws.id]) return;

      gameState.players[ws.id] = {
        id: ws.id,
        name: msg.name,
        money: 15000,
        position: 0,
        jailed: false,
        jailTurns: 0,
        properties: []
      };

      gameState.order.push(ws.id);

      broadcast({ type: "STATE", gameState });
    }

    /* ROLL */
    if (msg.type === "ROLL") {
      const player = currentPlayer();
      if (!player || player.id !== ws.id) return;

      const d1 = 1 + Math.floor(Math.random() * 6);
      const d2 = 1 + Math.floor(Math.random() * 6);
      const steps = d1 + d2;

      let oldPos = player.position;
      player.position = (player.position + steps) % 40;

      if (player.position < oldPos) {
        player.money += 2000; // GO bonus
      }

      const tile = gameState.board[player.position];

      // Rent
      if (tile.owner && tile.owner !== player.id && !tile.mortgaged) {
        const rent = Math.floor(tile.price * 0.2);
        player.money -= rent;
        gameState.players[tile.owner].money += rent;
      }

      gameState.currentTurn =
        (gameState.currentTurn + 1) % gameState.order.length;

      broadcast({
        type: "ROLL_RESULT",
        d1, d2,
        gameState
      });
    }

    /* BUY */
    if (msg.type === "BUY") {
      const player = currentPlayer();
      const tile = gameState.board[player.position];

      if (!tile.owner && tile.price > 0 && player.money >= tile.price) {
        player.money -= tile.price;
        tile.owner = player.id;
        player.properties.push(tile.id);
      }

      broadcast({ type: "STATE", gameState });
    }
  });

  ws.on("close", () => {
    delete gameState.players[ws.id];
    gameState.order = gameState.order.filter(id => id !== ws.id);
    broadcast({ type: "STATE", gameState });
  });
});

server.listen(process.env.PORT || 3000);
console.log("Server running");
