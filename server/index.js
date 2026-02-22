require('dotenv').config();

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: '*', credentials: true } // Or configured origin
});

app.use(cors({ origin: '*', credentials: true })); // Or configured origin
app.use(express.json());
const path = require('path');
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/servers', require('./routes/servers'));
app.use('/api/servers/:serverId/roles', require('./routes/roles'));
app.use('/api/servers/:serverId/bans', require('./routes/bans'));
app.use('/api/channels', require('./routes/messages'));
app.use('/api/dm', require('./routes/dm'));
app.use('/api/users', require('./routes/users'));
app.use('/api/admin', require('./routes/admin'));

// Socket.io
require('./socket')(io);
app.set('io', io);

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`[server] Running on port ${PORT}`);
});
