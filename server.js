const { createServer } = require('http');
const next = require('next');
const { Server } = require('socket.io');

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = process.env.PORT || 3001;

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer(handle);

  const io = new Server(httpServer);

  io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    // Handle room joining
    socket.on('joinRoom', (roomCode) => {
      socket.join(roomCode);
      const clients = io.sockets.adapter.rooms.get(roomCode)?.size || 0;
      socket.emit('roomJoined', `You have joined room: ${roomCode}`, socket.id, clients);
      socket.to(roomCode).emit('userJoined', { id: socket.id, clients });
      console.log(`Socket ${socket.id} joined room ${roomCode}`);
    });

    // Handle user disconnecting
    socket.on('disconnecting', () => {
      // Get the rooms the socket is in
      const rooms = Array.from(socket.rooms).filter((room) => room !== socket.id);
      rooms.forEach((room) => {
        // Since the socket is still in the room, subtract 1 to get the updated client count
        const clients = (io.sockets.adapter.rooms.get(room)?.size || 1) - 1;
        socket.to(room).emit('userLeft', { id: socket.id, clients });
        console.log(`Socket ${socket.id} is leaving room ${room}`);
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
