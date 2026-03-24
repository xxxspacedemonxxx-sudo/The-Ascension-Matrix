const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.get("/", (req, res) => {
  res.sendFile(__dirname + "/index.html");
});

// ---------- GAME ----------
let players = [];

function createBoss() {
  return {
    name: "Hex'Ra",
    hp: 800,
    maxHP: 800,
    phase: 1,
    turn: 0
  };
}

let boss = createBoss();

function createPlayer(id) {
  return {
    id,
    hp: 120,
    maxHP: 120,
    dead: false
  };
}

function alivePlayers() {
  return players.filter(p => !p.dead);
}

function damage(p, amount) {
  p.hp -= amount;
  if (p.hp <= 0) {
    p.hp = 0;
    p.dead = true;
  }
}

// ---------- BOSS ----------
function bossTurn() {
  const alive = alivePlayers();
  if (!alive.length) return;

  boss.turn++;

  let log = "";

  if (boss.phase === 1) {
    const t = alive[Math.floor(Math.random() * alive.length)];
    damage(t, 20);
    log = "Shadow Claw hits " + t.id.slice(0, 5);

    if (boss.turn % 3 === 0) {
      alive.forEach(p => damage(p, 10));
      log = "Void Blast hits all";
    }
  } else {
    alive.forEach(p => damage(p, 25));
    log = "🔥 Infernal Eruption!";
  }

  io.emit("LOG", log);
}

// ---------- SOCKET ----------
io.on("connection", (socket) => {
  console.log("Player:", socket.id);

  if (players.length === 0) boss = createBoss();

  const player = createPlayer(socket.id);
  players.push(player);

  socket.emit("STATE", { boss, players });

  socket.on("ACTION", (type) => {
    if (player.dead) return;

    if (type === "attack") {
      boss.hp -= 30;
      io.emit("LOG", "⚔ Attack");
    }

    if (type === "heal") {
      player.hp += 20;
      if (player.hp > player.maxHP) player.hp = player.maxHP;
      io.emit("LOG", "❤️ Heal");
    }

    if (boss.hp <= boss.maxHP / 2 && boss.phase === 1) {
      boss.phase = 2;
      io.emit("LOG", "🔥 HEX'RA TRANSFORMS");
    }

    if (boss.hp <= 0) {
      boss.hp = 0;
      io.emit("LOG", "🏆 BOSS DEFEATED");
    }

    io.emit("STATE", { boss, players });
  });

  socket.on("BOSS_TURN", () => {
    bossTurn();
    io.emit("STATE", { boss, players });
  });

  socket.on("RESPAWN", () => {
    Object.assign(player, createPlayer(player.id));
    io.emit("LOG", "Respawned");
    io.emit("STATE", { boss, players });
  });

  socket.on("disconnect", () => {
    players = players.filter(p => p.id !== socket.id);
    if (players.length === 0) boss = createBoss();
  });
});

// ---------- START ----------
server.listen(3000, () => {
  console.log("🔥 http://localhost:3000");
});