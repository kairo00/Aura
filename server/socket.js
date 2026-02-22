const db = require('./db');
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET;

const onlineUsers = new Set();

module.exports = (io) => {
    // Auth middleware for sockets
    io.use((socket, next) => {
        const token = socket.handshake.auth?.token;
        if (!token) return next(new Error('Unauthorized'));
        try {
            socket.user = jwt.verify(token, JWT_SECRET);
            next();
        } catch {
            next(new Error('Unauthorized'));
        }
    });

    io.on('connection', (socket) => {
        const { id: userId, username } = socket.user;
        console.log(`[socket] ${username} connected (${socket.id})`);

        socket.join(`user:${userId}`);
        onlineUsers.add(userId);
        io.emit('presence_update', { userId, status: 'online' });
        socket.emit('presence_state', Array.from(onlineUsers));

        // ── Channel chat ──────────────────────────────────
        socket.on('join_channel', ({ channelId }) => {
            socket.join(`channel:${channelId}`);
        });

        socket.on('leave_channel', ({ channelId }) => {
            socket.leave(`channel:${channelId}`);
        });

        socket.on('send_message', ({ channelId, content, attachmentUrl }) => {
            if (!content?.trim() && !attachmentUrl) return;
            const result = db.prepare(
                'INSERT INTO messages (channel_id, user_id, content, attachment_url) VALUES (?, ?, ?, ?)'
            ).run(channelId, userId, content?.trim() || '', attachmentUrl || null);

            const msg = db.prepare(`
        SELECT m.id, m.content, m.created_at, m.channel_id, m.attachment_url,
               u.id as user_id, u.username, u.avatar_color, u.avatar_url
        FROM messages m JOIN users u ON m.user_id = u.id
        WHERE m.id = ?
      `).get(result.lastInsertRowid);

            io.to(`channel:${channelId}`).emit('new_message', msg);
        });

        // ── Typing indicators ─────────────────────────────
        socket.on('typing_start', ({ channelId }) => {
            socket.to(`channel:${channelId}`).emit('user_typing', { username, channelId });
        });

        socket.on('typing_stop', ({ channelId }) => {
            socket.to(`channel:${channelId}`).emit('user_stop_typing', { username, channelId });
        });

        // ── Direct messages ───────────────────────────────
        socket.on('join_dm', ({ threadId }) => {
            socket.join(`dm:${threadId}`);
        });

        socket.on('leave_dm', ({ threadId }) => {
            socket.leave(`dm:${threadId}`);
        });

        socket.on('send_dm', ({ threadId, content, attachmentUrl }) => {
            if (!content?.trim() && !attachmentUrl) return;

            // Verify sender belongs to this thread
            const thread = db.prepare('SELECT * FROM dm_threads WHERE id = ?').get(threadId);
            if (!thread || (thread.user1_id !== userId && thread.user2_id !== userId)) return;

            const result = db.prepare(
                'INSERT INTO dm_messages (thread_id, sender_id, content, attachment_url) VALUES (?, ?, ?, ?)'
            ).run(threadId, userId, content?.trim() || '', attachmentUrl || null);

            const msg = db.prepare(`
        SELECT dm.id, dm.content, dm.created_at, dm.thread_id, dm.attachment_url,
               u.id as user_id, u.username, u.avatar_color, u.avatar_url
        FROM dm_messages dm JOIN users u ON dm.sender_id = u.id
        WHERE dm.id = ?
      `).get(result.lastInsertRowid);

            io.to(`dm:${threadId}`).emit('new_dm', msg);
        });

        socket.on('dm_typing_start', ({ threadId }) => {
            socket.to(`dm:${threadId}`).emit('dm_user_typing', { username, threadId });
        });

        socket.on('dm_typing_stop', ({ threadId }) => {
            socket.to(`dm:${threadId}`).emit('dm_user_stop_typing', { username, threadId });
        });

        socket.on('disconnect', () => {
            console.log(`[socket] ${username} disconnected`);
            // Check if user has other active sockets before marking offline
            const userSockets = io.sockets.adapter.rooms.get(`user:${userId}`);
            if (!userSockets || userSockets.size === 0) {
                onlineUsers.delete(userId);
                io.emit('presence_update', { userId, status: 'offline' });
            }
        });
    });
};
