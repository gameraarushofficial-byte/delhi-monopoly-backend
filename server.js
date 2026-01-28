const express = require("express");


socket.on("buyProperty", roomId => {
const game = games[roomId];
if (!game) return;


const player = game.players[game.currentTurn];
const tile = game.board[player.position];


if (tile.type !== "property") return;
if (tile.owner) return;
if (player.balance < tile.price) return;


player.balance -= tile.price;
tile.owner = player.id;
player.properties.push(tile.name);


io.to(roomId).emit("updateGame", game);
});
});


// ---------------- TILE HANDLER ----------------


function handleTile(game, player, tile) {
if (tile.type === "property") {
if (tile.owner && tile.owner !== player.id) {
const owner = game.players.find(p => p.id === tile.owner);
if (owner) {
player.balance -= tile.rent;
owner.balance += tile.rent;
}
}
}


if (tile.type === "tax") {
player.balance -= tile.amount;
}


if (tile.type === "start") {
player.balance += 200;
}
}


// ---------------- SERVER START ----------------


const PORT = process.env.PORT || 3000;


server.listen(PORT, () => {
console.log("Server running on port", PORT);
});
