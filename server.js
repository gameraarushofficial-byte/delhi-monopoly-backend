const WebSocket = require("ws");
const PORT = process.env.PORT || 3000;
const wss = new WebSocket.Server({ port: PORT });

// Unique tokens for up to 6 players
const TOKENS = ["🛺","🚇","🚌","🚗","🛵","🚲"];

let rooms = {};

function createBoard() {
  const board = [];
  for (let i = 0; i < 40; i++) {
    if (i === 0) board.push({ name: "GO", type: "go" });
    else if (i === 10) board.push({ name: "Jail", type: "jail" });
    else if (i === 20) board.push({ name: "Free Parking", type: "free" });
    else if (i === 30) board.push({ name: "Go To Jail", type: "go_to_jail" });
    else if (i % 5 === 0) board.push({ name: "Tax", type: "tax", amount: 1000 });
    else if (i % 3 === 0) board.push({ name: "Chance", type: "chance" });
    else board.push({
      name: "Delhi Area " + i,
      price: 2000 + i * 10,
      rent: 300 + i * 5,
      owner: null,
      mortgaged: false,
      houses: 0,
      hotel: false
    });
  }
  return board;
}

const chanceCards = [
  { text: "Metro Expansion", effect: (p, dice) => { p.money += dice >= 10 ? 2000 : 800; } },
  { text: "Illegal Fine", effect: (p, dice) => { p.money -= dice <= 4 ? 1200 : 400; } },
  { text: "Go To Jail", effect: (p, dice) => { p.pos = 10; p.inJail = true; p.jailTurns = 0; } }
];

function broadcast(room) {
  room.players.forEach(p => {
    p.ws.send(JSON.stringify({
      board: room.board,
      players: room.players.map(x => ({
        pos: x.pos,
        money: x.money,
        token: x.token,
        id: x.id
      })),
      turn: room.turn
    }));
  });
}

function checkBankruptcy(room, pid) {
  const p = room.players.find(x => x.id === pid);
  const ownsAssets = room.board.some(c => c.owner === pid && !c.mortgaged);
  if (p.money < 0 && !ownsAssets) {
    room.board.forEach(c => { if (c.owner === pid) { c.owner = null; c.mortgaged = false; } });
    room.players = room.players.filter(x => x.id !== pid);
    if (room.turn >= pid) room.turn = 0;
  }
}

wss.on("connection", ws => {
  ws.on("message", msg => {
    const data = JSON.parse(msg);

    if (data.type === "join") {
      if (!rooms[data.room]) rooms[data.room] = { players: [], board: createBoard(), turn: 0, max: data.max };
      const room = rooms[data.room];
      if (room.players.length >= room.max) return;

      const id = room.players.length;
      room.players.push({
        ws,
        id,
        pos: 0,
        money: 15000,
        inJail: false,
        jailTurns: 0,
        doubles: 0,
        token: TOKENS[id]
      });

      ws.room = data.room;
      ws.id = id;
      broadcast(room);
    }

    if (data.type === "roll") {
      const room = rooms[ws.room];
      if (room.turn !== ws.id) return;
      const p = room.players.find(x => x.id === ws.id);

      if (p.inJail) {
        const d1 = Math.floor(Math.random() * 6) + 1;
        const d2 = Math.floor(Math.random() * 6) + 1;
        if (d1 === d2) {
          p.inJail = false;
          p.jailTurns = 0;
        } else {
          p.jailTurns++;
          if (p.jailTurns >= 3) {
            p.money -= 1000;
            p.inJail = false;
            p.jailTurns = 0;
            room.turn = (room.turn + 1) % room.players.length;
            broadcast(room);
            return;
          } else {
            room.turn = (room.turn + 1) % room.players.length;
            broadcast(room);
            return;
          }
        }
      }

      const dice1 = Math.floor(Math.random() * 6) + 1;
      const dice2 = Math.floor(Math.random() * 6) + 1;
      const total = dice1 + dice2;

      p.pos = (p.pos + total) % 40;
      if (p.pos + total >= 40) p.money += 2000;

      const cell = room.board[p.pos];

      if (cell.type === "tax") p.money -= cell.amount;
      if (cell.type === "go_to_jail") { p.pos = 10; p.inJail = true; p.jailTurns = 0; }
      if (cell.type === "chance") { chanceCards[Math.floor(Math.random() * chanceCards.length)].effect(p, total); }

      if (cell.price) {
        if (cell.owner === null && p.money >= cell.price) { cell.owner = p.id; p.money -= cell.price; }
        else if (cell.owner !== p.id && !cell.mortgaged) {
          const owner = room.players.find(x => x.id === cell.owner);
          let rent = cell.rent + (cell.houses * 50) + (cell.hotel ? 200 : 0);
          p.money -= rent;
          owner.money += rent;
        }
      }

      room.turn = (dice1 === dice2) ? room.turn : (room.turn + 1) % room.players.length;

      checkBankruptcy(room, ws.id);
      broadcast(room);
    }

    if (data.type === "trade") {
      const room = rooms[ws.room];
      const from = room.players.find(x => x.id === data.from);
      const to = room.players.find(x => x.id === data.to);
      const prop = room.board[data.property];
      if (prop.owner === from.id) { prop.owner = to.id; from.money -= data.money; to.money += data.money; broadcast(room); }
    }

    if (data.type === "mortgage") {
      const room = rooms[ws.room];
      const prop = room.board[data.property];
      const p = room.players.find(x => x.id === ws.id);
      if (prop.owner === p.id && !prop.mortgaged) { prop.mortgaged = true; p.money += Math.floor(prop.price / 2); broadcast(room); }
    }
    
    if (data.type === "unmortgage") {
      const room = rooms[ws.room];
      const prop = room.board[data.property];
      const p = room.players.find(x => x.id === ws.id);
      if (prop.owner === p.id && prop.mortgaged && p.money >= Math.floor(prop.price * 0.55)) { p.money -= Math.floor(prop.price * 0.55); prop.mortgaged = false; broadcast(room); }
    }

    if (data.type === "build") {
      const room = rooms[ws.room];
      const prop = room.board[data.property];
      const p = room.players.find(x => x.id === ws.id);
      if (prop.owner === p.id && !prop.hotel && p.money >= 500) {
        if (prop.houses < 4) { prop.houses++; p.money -= 500; }
        else { prop.houses = 0; prop.hotel = true; p.money -= 1000; }
        broadcast(room);
      }
    }

    if (data.type === "sellHouseHotel") {
      const room = rooms[ws.room];
      const prop = room.board[data.property];
      const p = room.players.find(x => x.id === ws.id);
      if (prop.owner === p.id) {
        if (prop.hotel) { prop.hotel = false; p.money += 500; }
        else if (prop.houses > 0) { prop.houses--; p.money += 250; }
        broadcast(room);
      }
    }
  });
});

console.log("WebSocket Server running on port", PORT);

