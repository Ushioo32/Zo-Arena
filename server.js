const express = require('express');
const http = require('http');
const WebSocket = require('ws');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.static('public'));

const rooms = {};

function generateRoomCode() {
  return Math.random().toString(36).substring(2, 6).toUpperCase();
}

wss.on('connection', (ws) => {
  let currentRoom = null;
  let playerId = null;

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);

      if (data.type === 'CREATE_ROOM') {
        const code = generateRoomCode();
        rooms[code] = { host: ws, players: [ws] };
        currentRoom = code;
        playerId = 0;
        ws.send(JSON.stringify({ type: 'ROOM_CREATED', code, playerId }));
      } else if (data.type === 'JOIN_ROOM') {
        const code = data.code.toUpperCase();

        if (rooms[code] && rooms[code].players.length < 4) {
          currentRoom = code;
          playerId = rooms[code].players.length;
          rooms[code].players.push(ws);

          ws.send(JSON.stringify({
            type: 'JOIN_SUCCESS',
            code,
            playerId
          }));

          rooms[code].players.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify({
                type: 'PLAYER_JOINED',
                count: rooms[code].players.length
              }));
            }
          });
        } else {
          ws.send(JSON.stringify({
            type: 'ERROR',
            message: 'Room full or invalid code'
          }));
        }
      } else if (data.type === 'PLAYER_INPUT' || data.type === 'GAME_STATE') {
        if (currentRoom && rooms[currentRoom]) {
          rooms[currentRoom].players.forEach((client) => {
            if (client !== ws && client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify(data));
            }
          });
        }
      }
    } catch (err) {
      console.error(err);
    }
  });

  ws.on('close', () => {
    if (currentRoom && rooms[currentRoom]) {
      rooms[currentRoom].players =
        rooms[currentRoom].players.filter((p) => p !== ws);

      if (rooms[currentRoom].players.length === 0) {
        delete rooms[currentRoom];
      }
    }
  });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`ZO Arena Server running on port ${PORT}`);
});