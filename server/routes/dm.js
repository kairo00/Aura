const router = require('express').Router();
const db = require('../db');
const authMiddleware = require('../middleware/auth');

// Get all DM threads for current user
router.get('/', authMiddleware, (req, res) => {
  const threads = db.prepare(`
    SELECT dt.id, dt.created_at,
           u.id as partner_id, u.username as partner_username,
           u.avatar_color as partner_avatar_color, u.avatar_url as partner_avatar_url,
           (SELECT content FROM dm_messages WHERE thread_id = dt.id ORDER BY created_at DESC LIMIT 1) as last_message
    FROM dm_threads dt
    JOIN users u ON (
      CASE WHEN dt.user1_id = ? THEN dt.user2_id ELSE dt.user1_id END = u.id
    )
    WHERE dt.user1_id = ? OR dt.user2_id = ?
    ORDER BY dt.created_at DESC
  `).all(req.user.id, req.user.id, req.user.id);
  res.json(threads);
});

// Start or find a DM thread with another user
router.post('/:userId', authMiddleware, (req, res) => {
  const me = req.user.id;
  const other = parseInt(req.params.userId);
  if (me === other) return res.status(400).json({ error: 'Cannot DM yourself' });

  const [u1, u2] = me < other ? [me, other] : [other, me];
  let thread = db.prepare('SELECT * FROM dm_threads WHERE user1_id = ? AND user2_id = ?').get(u1, u2);
  if (!thread) {
    const r = db.prepare('INSERT INTO dm_threads (user1_id, user2_id) VALUES (?, ?)').run(u1, u2);
    thread = db.prepare('SELECT * FROM dm_threads WHERE id = ?').get(r.lastInsertRowid);
  }
  res.json(thread);
});

// Get messages for a DM thread (with reactions)
router.get('/:threadId/messages', authMiddleware, (req, res) => {
  const messages = db.prepare(`
    SELECT dm.id, dm.content, dm.created_at, dm.thread_id, dm.attachment_url,
           u.id as user_id, u.username, u.avatar_color, u.avatar_url,
           (SELECT json_group_array(json_object('emoji', r.emoji, 'user_id', r.user_id))
            FROM dm_reactions r WHERE r.dm_message_id = dm.id) as reactions
    FROM dm_messages dm
    JOIN users u ON dm.sender_id = u.id
    WHERE dm.thread_id = ?
    ORDER BY dm.created_at ASC
    LIMIT 50
  `).all(req.params.threadId);

  const parsed = messages.map(m => ({
    ...m,
    reactions: m.reactions ? JSON.parse(m.reactions).filter(r => r.emoji) : []
  }));
  res.json(parsed);
});

// Add reaction to a DM message
router.post('/:messageId/reactions', authMiddleware, (req, res) => {
  const { emoji } = req.body;
  if (!emoji) return res.status(400).json({ error: 'Emoji required' });
  try {
    db.prepare('INSERT OR IGNORE INTO dm_reactions (dm_message_id, user_id, emoji) VALUES (?, ?, ?)')
      .run(req.params.messageId, req.user.id, emoji);

    const dmMsg = db.prepare('SELECT thread_id FROM dm_messages WHERE id = ?').get(req.params.messageId);
    const io = req.app.get('io');
    if (io && dmMsg) {
      io.to(`dm:${dmMsg.thread_id}`).emit('dm_reaction_updated', {
        messageId: req.params.messageId,
        emoji,
        userId: req.user.id,
        action: 'add'
      });
    }
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Remove reaction from a DM message
router.delete('/:messageId/reactions/:emoji', authMiddleware, (req, res) => {
  try {
    db.prepare('DELETE FROM dm_reactions WHERE dm_message_id = ? AND user_id = ? AND emoji = ?')
      .run(req.params.messageId, req.user.id, req.params.emoji);

    const dmMsg = db.prepare('SELECT thread_id FROM dm_messages WHERE id = ?').get(req.params.messageId);
    const io = req.app.get('io');
    if (io && dmMsg) {
      io.to(`dm:${dmMsg.thread_id}`).emit('dm_reaction_updated', {
        messageId: req.params.messageId,
        emoji: req.params.emoji,
        userId: req.user.id,
        action: 'remove'
      });
    }
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
