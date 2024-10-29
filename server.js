const { createServer } = require('http');
const next = require('next');
const { Server } = require('socket.io');

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = process.env.PORT || 3001;

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// Track rooms and their players
const rooms = new Map();

app.prepare().then(() => {
  const httpServer = createServer(handle);
  const io = new Server(httpServer);

  io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    socket.on('joinRoom', (roomCode) => {
      // Initialize room if it doesn't exist
      if (!rooms.has(roomCode)) {
        rooms.set(roomCode, []);
      }

      const roomPlayers = rooms.get(roomCode);
      const isFirstPlayer = roomPlayers.length === 0;

      // Create new player
      const newPlayer = {
        id: socket.id,
        name: `Player ${roomPlayers.length + 1}`,
        avatar: "/placeholder.svg?height=32&width=32",
        isHost: isFirstPlayer
      };

      // Add player to room
      roomPlayers.push(newPlayer);
      rooms.set(roomCode, roomPlayers);

      // Join the socket room
      socket.join(roomCode);

      // Send current room state to the joining player
      socket.emit('roomJoined', {
        message: `You have joined room: ${roomCode}`,
        currentPlayer: newPlayer,
        players: roomPlayers
      });

      // Notify others in the room
      socket.to(roomCode).emit('userJoined', {
        newPlayer,
        players: roomPlayers
      });

      console.log(`Socket ${socket.id} joined room ${roomCode}`, roomPlayers);
    });

    // Handle user disconnecting
    socket.on('disconnecting', () => {
      const rooms = Array.from(socket.rooms).filter((room) => room !== socket.id);
      
      rooms.forEach((roomCode) => {
        const roomPlayers = rooms.get(roomCode);
        if (!roomPlayers) return;

        // Remove the disconnecting player
        const updatedPlayers = roomPlayers.filter(player => player.id !== socket.id);

        // If there are remaining players, reassign host if needed
        if (updatedPlayers.length > 0 && !updatedPlayers.some(p => p.isHost)) {
          updatedPlayers[0].isHost = true;
        }

        // Update the rooms map
        if (updatedPlayers.length === 0) {
          rooms.delete(roomCode);
        } else {
          rooms.set(roomCode, updatedPlayers);
        }

        // Notify others in the room
        socket.to(roomCode).emit('userLeft', {
          id: socket.id,
          players: updatedPlayers
        });

        console.log(`Socket ${socket.id} is leaving room ${roomCode}`, updatedPlayers);
      });
    });

    socket.on('disconnect', () => {
      console.log('User disconnected:', socket.id);
    });
  });

  httpServer.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
  });
});