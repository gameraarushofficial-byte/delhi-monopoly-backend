import express from "express";
import { WebSocketServer } from "ws";
import { v4 as uuid } from "uuid";
import { board } from "./boardData.js";

const app = express();
const server = app.listen(process.env.PORT || 3000);
const wss = new WebSocketServer({ server });

const players = {};
let turnOrder = [];
let currentTurn = 0;

function broadcast(data) {
  wss.clients.forEach(c => {
    if (c.readyState === 1) c.send(JSON.stringify(data));
  });
}

wss.on("connection", ws => {
  ws.on("message", msg => {
    const data = JSON.parse(msg);

    // JOIN
    if (data.type === "join") {
      const id = uuid();
      players[id] = {
        id,
        name: data.name,
        password: data.password,
        money: 15000,
        position: 0
      };
      turnOrder.push(id);
      ws.playerId = id;

      ws.send(JSON.stringify({
        type: "joined",
        playerId: id,
        players,
        board,
        turn: turnOrder[currentTurn]
      }));

      broadcast({ type: "update", players, board });
    }

    // ROLL
    if (data.type === "roll") {
      if (turnOrder[currentTurn] !== ws.playerId) return;

      const dice1 = Math.ceil(Math.random() * 6);
      const dice2 = Math.ceil(Math.random() * 6);
      const steps = dice1 + dice2;

      const p = players[ws.playerId];
      p.position = (p.position + steps) % board.length;

      const tile = board[p.position];

      // GO bonus
      if (p.position < steps) p.money += 1500;

      // PROPERTY
      if (tile.price && tile.owner && tile.owner !== p.id) {
        p.money -= tile.rent;
        players[tile.owner].money += tile.rent;
      }

      currentTurn = (currentTurn + 1) % turnOrder.length;

      broadcast({
        type: "rolled",
        dice1,
        dice2,
        players,
        board,
        turn: turnOrder[currentTurn]
      });
    }

    // BUY
    if (data.type === "buy") {
      const p = players[ws.playerId];
      const tile = board[p.position];

      if (tile.price && !tile.owner && p.money >= tile.price) {
        p.money -= tile.price;
        tile.owner = p.id;
        broadcast({ type: "update", players, board });
      }
    }
  });
});

console.log("Server running");
