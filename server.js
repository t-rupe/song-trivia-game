const { createServer } = require('http');
const next = require('next');
const { Server } = require('socket.io');

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = process.env.PORT || 3001;

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// Track rooms and their players
const gameRooms = new Map(); // Renamed to avoid conflict
const socketToRoom = new Map(); // Add tracking for cleanup

app.prepare().then(() => {
  const httpServer = createServer(handle);
  const io = new Server(httpServer, {
    // Add configuration for better reconnection handling
    pingTimeout: 60000,
    pingInterval: 25000
  });

  io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    socket.on('joinRoom', (roomCode) => {
      // Cleanup previous room if exists
      const prevRoom = socketToRoom.get(socket.id);
      if (prevRoom) {
        socket.leave(prevRoom);
        const prevPlayers = gameRooms.get(prevRoom);
        if (prevPlayers) {
          const updated = prevPlayers.filter(p => p.id !== socket.id);
          if (updated.length === 0) {
            gameRooms.delete(prevRoom);
          } else {
            gameRooms.set(prevRoom, updated);
          }
        }
      }

      // Initialize room if it doesn't exist
      if (!gameRooms.has(roomCode)) {
        gameRooms.set(roomCode, []);
      }

      const roomPlayers = gameRooms.get(roomCode);
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
      gameRooms.set(roomCode, roomPlayers);
      socketToRoom.set(socket.id, roomCode); // Track which room this socket is in

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
      const currentRoomCode = socketToRoom.get(socket.id);
      if (currentRoomCode) {
        const roomPlayers = gameRooms.get(currentRoomCode);
        if (roomPlayers) {
          // Remove the disconnecting player
          const updatedPlayers = roomPlayers.filter(player => player.id !== socket.id);

          // If there are remaining players, reassign host if needed
          if (updatedPlayers.length > 0 && !updatedPlayers.some(p => p.isHost)) {
            updatedPlayers[0].isHost = true;
          }

          // Update or remove the room
          if (updatedPlayers.length === 0) {
            gameRooms.delete(currentRoomCode);
          } else {
            gameRooms.set(currentRoomCode, updatedPlayers);
          }

          // Notify others in the room
          socket.to(currentRoomCode).emit('userLeft', {
            id: socket.id,
            players: updatedPlayers
          });

          console.log(`Socket ${socket.id} is leaving room ${currentRoomCode}`, updatedPlayers);
        }
        socketToRoom.delete(socket.id);
      }
    });

    socket.on('disconnect', () => {
      console.log('User disconnected:', socket.id);
      // Clean up socketToRoom mapping
      socketToRoom.delete(socket.id);
    });
  });

  httpServer.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
  });
});