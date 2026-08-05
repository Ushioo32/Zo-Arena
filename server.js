// server.js - Node.js Multiplayer Game Server for ZO Arena
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

const rooms = {};

io.on('connection', (socket) => {
  console.log(`Fighter connected: ${socket.id}`);

  // Join or create a multiplayer arena room
  socket.on('join_room', ({ roomCode, username, formatIdx, modeIdx }) => {
    socket.join(roomCode);
    if (!rooms[roomCode]) {
      rooms[roomCode] = {
        players: [],
        formatIdx: formatIdx || 1,
        modeIdx: modeIdx || 0,
        gameStarted: false
      };
    }

    const room = rooms[roomCode];
    const playerIndex = room.players.length;
    
    const player = {
      id: socket.id,
      playerIndex,
      username: username || `Fighter ${playerIndex + 1}`,
      heroIndex: 0,
      ready: false
    };

    room.players.push(player);

    // Broadcast updated room state to all clients in the room
    io.to(roomCode).emit('room_update', {
      players: room.players,
      formatIdx: room.formatIdx,
      modeIdx: room.modeIdx
    });
  });

  // Handle character selection and ready lock-in
  socket.on('select_hero', ({ roomCode, heroIndex }) => {
    const room = rooms[roomCode];
    if (!room) return;
    const player = room.players.find(p => p.id === socket.id);
    if (player) {
      player.heroIndex = heroIndex;
      player.ready = true;
      io.to(roomCode).emit('room_update', { players: room.players, formatIdx: room.formatIdx, modeIdx: room.modeIdx });

      // Check if all players in the room are ready to start the match
      if (room.players.length > 0 && room.players.every(p => p.ready) && !room.gameStarted) {
        room.gameStarted = true;
        io.to(roomCode).emit('start_match', { players: room.players });
      }
    }
  });

  // Real-time input and position synchronization
  socket.on('player_input', ({ roomCode, inputData }) => {
    socket.to(roomCode).emit('remote_player_input', { id: socket.id, inputData });
  });

  socket.on('state_sync', ({ roomCode, state }) => {
    socket.to(roomCode).emit('remote_state_sync', state);
  });

  socket.on('disconnect', () => {
    for (const roomCode in rooms) {
      const room = rooms[roomCode];
      const index = room.players.findIndex(p => p.id === socket.id);
      if (index !== -1) {
        room.players.splice(index, 1);
        io.to(roomCode).emit('room_update', { players: room.players, formatIdx: room.formatIdx, modeIdx: room.modeIdx });
        if (room.players.length === 0) delete rooms[roomCode];
        break;
      }
    }
    console.log(`Fighter disconnected: ${socket.id}`);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`ZO Arena Multiplayer Server running on port ${PORT}`);
});
