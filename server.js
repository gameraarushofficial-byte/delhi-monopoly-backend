// server.js - Complete Delhi Monopoly Backend
const WebSocket = require('ws');

const PORT = process.env.PORT || 8080;
const wss = new WebSocket.Server({ port: PORT });
console.log("Delhi Monopoly Backend running on port", PORT);

// ===== Game Data =====
let rooms = {}; // roomName -> gameState

// ===== Helper Functions =====
function randomDice() { return [1+Math.floor(Math.random()*6),1+Math.floor(Math.random()*6)]; }

function broadcast(roomName,data){
  if(!rooms[roomName]) return;
  rooms[roomName].players.forEach(p=>{
    if(p.ws && p.ws.readyState===WebSocket.OPEN) p.ws.send(JSON.stringify(data));
  });
}

function nextTurn(game){
  let idx = game.turnIndex;
  do {
    idx = (idx+1) % game.players.length;
  } while(game.players[idx].bankrupt);
  game.turnIndex = idx;
  game.turn = game.players[idx].id;
}

// ===== Delhi Board Properties =====
const delhiProperties=[
  {name:"GO",type:"dark",price:null},{name:"Connaught Place",type:"light",price:1500},{name:"Income Tax",type:"medium",price:null},{name:"Karol Bagh",type:"light",price:1600},
  {name:"Chance",type:"medium",price:null},{name:"Lajpat Nagar",type:"light",price:1800},{name:"Chandni Chowk",type:"light",price:2000},{name:"Jail (Visiting)",type:"dark",price:null},
  {name:"Rajouri Garden",type:"light",price:2200},{name:"Free Parking",type:"dark",price:null},{name:"Punjabi Bagh",type:"light",price:2400},{name:"Nehru Place",type:"light",price:2600},
  {name:"Chance",type:"medium",price:null},{name:"Hauz Khas",type:"light",price:2800},{name:"Anand Vihar",type:"light",price:3000},{name:"Go to Jail",type:"dark",price:null},
  {name:"Vasant Kunj",type:"light",price:3200},{name:"Saket",type:"light",price:3400},{name:"Dilli Haat",type:"light",price:3600},{name:"Chance",type:"medium",price:null},
  {name:"RK Puram",type:"light",price:3800},{name:"Dwarka",type:"light",price:4000},{name:"Income Tax",type:"medium",price:null},{name:"Chanakyapuri",type:"light",price:4200},
  {name:"Free Parking",type:"dark",price:null},{name:"Rohini",type:"light",price:4400},{name:"Mayur Vihar",type:"light",price:4500},{name:"Chance",type:"medium",price:null},
  {name:"Lodhi Road",type:"light",price:2200},{name:"Inderlok",type:"light",price:2000},{name:"Go to Jail",type:"dark",price:null},{name:"Pitampura",type:"light",price:1800},
  {name:"Rajiv Chowk",type:"light",price:1600},{name:"Chhatarpur",type:"light",price:1400},{name:"Chance",type:"medium",price:null},{name:"Safdarjung",type:"light",price:1200},
  {name:"Hauz Khas Village",type:"light",price:1300},{name:"Income Tax",type:"medium",price:null},{name:"Connaught Place Extension",type:"light",price:1500},{name:"Free Parking",type:"dark",price:null}
];

// ===== Create Room =====
function createRoom(roomName,maxPlayers){
  if(rooms[roomName]) return rooms[roomName];
  const board = delhiProperties.map(p=>({...p,owner:null,houses:0,hotel:false,mortgaged:false}));
  const players=[];
  for(let i=0;i<maxPlayers;i++){
    players.push({id:i,pos:0,money:5000,jailTurns:0,inJail:false,bankrupt:false,ws:null});
  }
  rooms[roomName]={board,players,turnIndex:0,turn:0,roomName,dice:[1,1]};
  rooms[roomName].turn = 0;
  return rooms[roomName];
}

// ===== WebSocket Handlers =====
function handleJoin(ws,msg){
  const roomName = msg.room || "default";
  const maxPlayers = msg.max || 2;
  const game = createRoom(roomName,maxPlayers);
  const player = game.players.find(p=>!p.ws);
  if(!player){ ws.send(JSON.stringify({error:"Room full"})); return; }
  player.ws=ws; ws.playerId=player.id; ws.roomName=roomName;
  ws.send(JSON.stringify({...game,you:player.id}));
  broadcast(roomName,{...game,you:player.id});
}

// ===== Player Actions =====
function handleRoll(ws){
  const game = rooms[ws.roomName];
  if(game.turn !== ws.playerId) return;
  const player = game.players[ws.playerId];
  if(player.bankrupt) return;

  const dice = randomDice();
  game.dice = dice;

  // Jail logic
  if(player.inJail){
    if(dice[0]===dice[1]){
      player.inJail=false; player.jailTurns=0;
    } else {
      player.jailTurns++;
      if(player.jailTurns>=3){ player.inJail=false; player.jailTurns=0; player.money-=300; }
      broadcast(ws.roomName,{...game,chance:`Player ${player.id} is in Jail`});
      nextTurn(game); return;
    }
  }

  let steps = dice[0]+dice[1];
  let passedGo=false;
  for(let s=0;s<steps;s++){
    player.pos = (player.pos+1)%40;
    if(player.pos===0) passedGo=true;
  }
  if(passedGo) player.money += 2000;

  const tile = game.board[player.pos];
  let chanceMsg=null;

  if(tile.type==="medium"){ // Chance/Tax
    const effect = [-500,-300,300,500,0][Math.floor(Math.random()*5)];
    player.money+=effect;
    chanceMsg=`Chance/Tax: ${effect>=0?"+₹"+effect:"-₹"+(-effect)}`;
  }

  // Rent
  if(tile.owner!==null && tile.owner!==player.id && !tile.mortgaged){
    let rent = tile.price/5;
    if(tile.houses) rent+=tile.houses*50;
    if(tile.hotel) rent+=200;
    player.money-=rent;
    game.players[tile.owner].money+=rent;
    if(player.money<0) player.bankrupt=true;
  }

  // Go to Jail
  if(tile.name.includes("Go to Jail")){ player.inJail=true; player.jailTurns=0; player.pos=9; chanceMsg="Go to Jail!"; }

  broadcast(ws.roomName,{...game,chance:chanceMsg});
  if(dice[0]!==dice[1]) nextTurn(game);
}

function handleBuy(ws){
  const game=rooms[ws.roomName]; const player=game.players[ws.playerId];
  const tile=game.board[player.pos];
  if(tile.price && tile.owner===null && player.money>=tile.price){
    tile.owner=player.id; player.money-=tile.price;
  }
  broadcast(ws.roomName,{...game});
}

function handleSell(ws){
  const game=rooms[ws.roomName]; const player=game.players[ws.playerId];
  const tile=game.board[player.pos];
  if(tile.owner===player.id){
    player.money+=Math.floor(tile.price/2); tile.owner=null; tile.houses=0; tile.hotel=false;
  }
  broadcast(ws.roomName,{...game});
}

function handleMortgage(ws){
  const game=rooms[ws.roomName]; const player=game.players[ws.playerId];
  const tile=game.board[player.pos];
  if(tile.owner===player.id && !tile.mortgaged){ tile.mortgaged=true; player.money+=Math.floor(tile.price/2); }
  broadcast(ws.roomName,{...game});
}

function handleUnmortgage(ws){
  const game=rooms[ws.roomName]; const player=game.players[ws.playerId];
  const tile=game.board[player.pos];
  const cost = Math.floor(tile.price/2*1.1);
  if(tile.owner===player.id && tile.mortgaged && player.money>=cost){ tile.mortgaged=false; player.money-=cost; }
  broadcast(ws.roomName,{...game});
}

function handleBuildHouse(ws){
  const game=rooms[ws.roomName]; const player=game.players[ws.playerId];
  const tile=game.board[player.pos];
  if(tile.owner===player.id && tile.houses<4 && player.money>=Math.floor(tile.price/4)){
    tile.houses++; player.money-=Math.floor(tile.price/4);
  }
  broadcast(ws.roomName,{...game});
}

function handleBuildHotel(ws){
  const game=rooms[ws.roomName]; const player=game.players[ws.playerId];
  const tile=game.board[player.pos];
  if(tile.owner===player.id && tile.houses===4 && !tile.hotel && player.money>=tile.price){
    tile.hotel=true; tile.houses=0; player.money-=tile.price;
  }
  broadcast(ws.roomName,{...game});
}

// Trade placeholder
function handleTrade(ws,msg){
  const game = rooms[ws.roomName];
  broadcast(ws.roomName,{...game,chance:`Trade requested with player ${msg.with}`});
}

// ===== WebSocket Connection =====
wss.on('connection', function(ws){
  ws.on('message', function(raw){
    let msg;
    try{ msg=JSON.parse(raw);}catch(e){return;}
    if(msg.type==="join") handleJoin(ws,msg);
    else if(msg.type==="roll") handleRoll(ws);
    else if(msg.type==="buy") handleBuy(ws);
    else if(msg.type==="sell") handleSell(ws);
    else if(msg.type==="mortgage") handleMortgage(ws);
    else if(msg.type==="unmortgage") handleUnmortgage(ws);
    else if(msg.type==="buildHouse") handleBuildHouse(ws);
    else if(msg.type==="buildHotel") handleBuildHotel(ws);
    else if(msg.type==="trade") handleTrade(ws,msg);
  });

  ws.on('close', ()=>{
    const game = rooms[ws.roomName]; if(!game) return;
    const player = game.players[ws.playerId]; if(player) player.ws=null;
  });
});
