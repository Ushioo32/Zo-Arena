const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);

// Configure Socket.io with robust CORS support
const io = new Server(server, {
  cors: {
    origin: "*", // Adjust this to your client URL in production
    methods: ["GET", "POST"]
  },
  pingInterval: 10000,
  pingTimeout: 5000
});

// In-memory state tracking for rooms and player coordinates
const rooms = new Map();

io.on('connection', (socket) => {
  console.log(`🟢 Player connected: ${socket.id}`);

  // 1. Join a specific room/lobby
  socket.on('join_room', ({ room, playerName }) => {
    socket.join(room);
    console.log(`📥 ${playerName} (${socket.id}) joined room: ${room}`);

    if (!rooms.has(room)) {
      rooms.set(room, new Map());
    }
    
    // Store initial player state
    rooms.get(room).set(socket.id, { id: socket.id, name: playerName, x: 0, y: 0 });

    // Notify other players in the room
    socket.to(room).emit('player_joined', { id: socket.id, name: playerName });

    // Send existing players to the newly joined player
    const roomPlayers = Array.from(rooms.get(room).values());
    socket.emit('current_players', roomPlayers);
  });

  // 2. Handle state updates (e.g., player movement, actions)
  socket.on('player_move', ({ room, x, y }) => {
    if (rooms.has(room) && rooms.get(room).has(socket.id)) {
      const player = rooms.get(room).get(socket.id);
      player.x = x;
      player.y = y;

      // Broadcast position update to everyone else in the room
      socket.to(room).emit('player_moved', { id: socket.id, x, y });
    }
  });

  // 3. Handle disconnections and cleanup to prevent memory leaks
  socket.on('disconnect', () => {
    console.log(`🔴 Player disconnected: ${socket.id}`);
    
    for (const [room, players] of rooms.entries()) {
      if (players.has(socket.id)) {
        players.delete(socket.id);
        socket.to(room).emit('player_left', { id: socket.id });

        // Clean up empty rooms to save memory
        if (players.size === 0) {
          rooms.delete(room);
          console.log(`🧹 Room ${room} deleted (empty).`);
        }
        break;
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Multiplayer server running on port ${PORT}`);
});
