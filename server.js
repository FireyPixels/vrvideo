const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

io.on('connection', socket => {
  console.log('✅ A user connected:', socket.id);

  socket.on('offer', data => {
    console.log('📡 Received offer from', socket.id);
    socket.broadcast.emit('offer', data);
  });

  socket.on('answer', data => {
    console.log('📡 Received answer from', socket.id);
    socket.broadcast.emit('answer', data);
  });

  socket.on('ice-candidate', data => {
    console.log('❄️ Received ICE candidate from', socket.id);
    socket.broadcast.emit('ice-candidate', data);
  });

  socket.on('disconnect', () => {
    console.log('❌ User disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Signaling server running on port ${PORT}`);
});
