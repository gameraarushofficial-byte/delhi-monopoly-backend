import express from "express";
import http from "http";
import { WebSocketServer } from "ws";
import { v4 as uuidv4 } from "uuid";

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(express.json());

/* ------------------ GAME STATE ------------------ */

const players = {};
let turnOrder = [];
let currentTurnIndex = 0;

const INITIAL_MONEY = 15000;

/* ------------------ WEBSOCKET ------------------ */

wss.on("connection", (ws) => {
  const playerId = uuidv4();

  players[playerId] = {
    id: playerId,
    name: null,
    money: INITIAL_MONEY,
    position: 0,
    inJail: false,
    jailTurns: 0
  };

  ws.send(
    JSON.stringify({
      type: "CONNECTED",
      playerId
    })
  );

  ws.on("message", (msg) => {
    let data;
    try {
      data = JSON.parse(msg);
    } catch {
      return;
    }

    /* ---- JOIN GAME ---- */
    if (data.type === "JOIN") {
      players[playerId].name = data.name;
      turnOrder.push(playerId);

      broadcast({
        type: "PLAYERS_UPDATE",
        players,
        turnOrder,
        currentTurnIndex
      });
    }

    /* ---- ROLL DICE ---- */
    if (data.type === "ROLL_DICE") {
      const currentPlayerId = turnOrder[currentTurnIndex];
      if (playerId !== currentPlayerId) return;

      const d1 = Math.ceil(Math.random() * 6);
      const d2 = Math.ceil(Math.random() * 6);
      const steps = d1 + d2;

      players[playerId].position =
        (players[playerId].position + steps) % 40;

      currentTurnIndex =
        (currentTurnIndex + 1) % turnOrder.length;

      broadcast({
        type: "DICE_ROLL",
        dice: [d1, d2],
        playerId,
        position: players[playerId].position,
        currentTurnIndex
      });
    }
  });

  ws.on("close", () => {
    delete players[playerId];
    turnOrder = turnOrder.filter((id) => id !== playerId);
  });
});

/* ------------------ HELPERS ------------------ */

function broadcast(data) {
  const msg = JSON.stringify(data);
  wss.clients.forEach((client) => {
    if (client.readyState === 1) {
      client.send(msg);
    }
  });
}

/* ------------------ START SERVER ------------------ */
/* 🔴 THIS IS THE PART RAILWAY NEEDS */

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log("✅ Server running on port", PORT);
});
