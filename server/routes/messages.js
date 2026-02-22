const router = require('express').Router();
const db = require('../db');
const authMiddleware = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, '../uploads'))
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname))
  }
});
const upload = multer({ storage: storage });

// Get messages for a channel (paginated, recent first returned in chronological order)
router.get('/:id/messages', authMiddleware, (req, res) => {
  const before = req.query.before;
  let query = `
    SELECT m.id, m.content, m.created_at, m.channel_id, m.attachment_url,
           u.id as user_id, u.username, u.avatar_color, u.avatar_url,
           (SELECT json_group_array(json_object('emoji', r.emoji, 'user_id', r.user_id)) 
            FROM reactions r WHERE r.message_id = m.id) as reactions
    FROM messages m
    JOIN users u ON m.user_id = u.id
    WHERE m.channel_id = ?
    `;
  let params = [req.params.id];

  if (before) {
    query += ' AND m.id < ? ';
    params.push(before);
  }

  query += ' ORDER BY m.id DESC LIMIT 50';

  let messages = db.prepare(query).all(...params);
  messages = messages.reverse().map(m => {
    m.reactions = m.reactions ? JSON.parse(m.reactions).filter(r => r.emoji) : [];
    return m;
  });

  res.json(messages);
});

// Upload image
router.post('/upload', authMiddleware, upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const fileUrl = `/uploads/${req.file.filename}`;
  res.json({ url: fileUrl });
});

// Add reaction
router.post('/:id/reactions', authMiddleware, (req, res) => {
  const { emoji } = req.body;
  if (!emoji) return res.status(400).json({ error: 'Emoji required' });

  try {
    db.prepare('INSERT OR IGNORE INTO reactions (message_id, user_id, emoji) VALUES (?, ?, ?)')
      .run(req.params.id, req.user.id, emoji);

    const msg = db.prepare('SELECT channel_id FROM messages WHERE id = ?').get(req.params.id);
    const io = req.app.get('io');
    if (io && msg) {
      io.to(`channel:${msg.channel_id}`).emit('reaction_updated', { messageId: req.params.id, emoji, userId: req.user.id, action: 'add' });
    }

    res.json({ success: true, emoji, user_id: req.user.id });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Remove reaction
router.delete('/:id/reactions/:emoji', authMiddleware, (req, res) => {
  try {
    db.prepare('DELETE FROM reactions WHERE message_id = ? AND user_id = ? AND emoji = ?')
      .run(req.params.id, req.user.id, req.params.emoji);

    const msg = db.prepare('SELECT channel_id FROM messages WHERE id = ?').get(req.params.id);
    const io = req.app.get('io');
    if (io && msg) {
      io.to(`channel:${msg.channel_id}`).emit('reaction_updated', { messageId: req.params.id, emoji: req.params.emoji, userId: req.user.id, action: 'remove' });
    }

    res.json({ success: true, emoji: req.params.emoji, user_id: req.user.id });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Delete a message (author OR can_manage_messages permission OR Admin)
router.delete('/messages/:id', authMiddleware, (req, res) => {
  const msg = db.prepare(`
    SELECT m.*, sm.role, sm.role_id, sr.can_manage_messages
    FROM messages m
    JOIN channels c ON c.id = m.channel_id
    LEFT JOIN server_members sm ON sm.server_id = c.server_id AND sm.user_id = ?
    LEFT JOIN server_roles sr ON sr.id = sm.role_id
    WHERE m.id = ?
  `).get(req.user.id, req.params.id)

  if (!msg) return res.status(404).json({ error: 'Message not found' })

  const isAuthor = msg.user_id === req.user.id
  const isAdmin = msg.role === 'Admin'
  const hasPerm = msg.can_manage_messages === 1

  if (!isAuthor && !isAdmin && !hasPerm) {
    return res.status(403).json({ error: 'No permission to delete this message' })
  }

  db.prepare('DELETE FROM messages WHERE id = ?').run(req.params.id)

  const io = req.app.get('io')
  if (io) {
    io.to(`channel:${msg.channel_id}`).emit('message_deleted', { messageId: Number(req.params.id), channelId: msg.channel_id })
  }

  res.json({ ok: true })
})

module.exports = router;
