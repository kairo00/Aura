const router = require('express').Router();
const db = require('../db');
const authMiddleware = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadsDir),
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname)
        cb(null, `user_${req.user?.id || 'x'}_${Date.now()}${ext}`)
    }
})
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

// Get all users (for starting DMs)
router.get('/', authMiddleware, (req, res) => {
    const users = db.prepare('SELECT id, username, avatar_color, avatar_url FROM users WHERE id != ? ORDER BY username').all(req.user.id);
    res.json(users);
});

// Update current user's profile
router.patch('/me', authMiddleware, (req, res) => {
    const { username, avatar_color, avatar_url } = req.body;
    const updates = [];
    const values = [];
    if (username) { updates.push('username = ?'); values.push(username); }
    if (avatar_color) { updates.push('avatar_color = ?'); values.push(avatar_color); }
    if (avatar_url !== undefined) { updates.push('avatar_url = ?'); values.push(avatar_url); }

    if (updates.length === 0) return res.status(400).json({ error: 'Nothing to update' });
    values.push(req.user.id);

    try {
        db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...values);
        const user = db.prepare('SELECT id, username, avatar_color, avatar_url, is_superadmin FROM users WHERE id = ?').get(req.user.id);
        res.json(user);
    } catch (e) {
        if (e.message.includes('UNIQUE')) return res.status(409).json({ error: 'Username already taken' });
        res.status(500).json({ error: e.message });
    }
});

// Delete current user account
router.delete('/me', authMiddleware, (req, res) => {
    try {
        const userId = req.user.id;
        db.transaction(() => {
            // Drop servers owned by the user (which will cascade to members, channels, and messages inside)
            db.prepare('DELETE FROM servers WHERE owner_id = ?').run(userId);
            // Drop direct messages strings and messages pointing to user
            db.prepare('DELETE FROM dm_threads WHERE user1_id = ? OR user2_id = ?').run(userId, userId);
            db.prepare('DELETE FROM dm_messages WHERE sender_id = ?').run(userId);
            // Drop any regular messages authored by the user in other servers
            db.prepare('DELETE FROM messages WHERE user_id = ?').run(userId);
            // Drop invites and reactions
            db.prepare('DELETE FROM invites WHERE created_by = ?').run(userId);
            db.prepare('DELETE FROM reactions WHERE user_id = ?').run(userId);
            db.prepare('DELETE FROM dm_reactions WHERE user_id = ?').run(userId);
            db.prepare('DELETE FROM server_members WHERE user_id = ?').run(userId);

            // Finally, drop the user
            db.prepare('DELETE FROM users WHERE id = ?').run(userId);
        })();
        res.json({ success: true });
    } catch (e) {
        console.error('Delete error:', e);
        res.status(500).json({ error: e.message });
    }
});

// Upload avatar for current user — returns full absolute URL so frontend never guesses the base
router.post('/me/upload', authMiddleware, upload.single('image'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    // Filename was generated once by multer diskStorage — use it as-is
    const relativePath = `/uploads/${req.file.filename}`;
    const absoluteUrl = `${process.env.APP_URL || 'http://localhost:3001'}${relativePath}`;
    try {
        // Save the RELATIVE path to DB (portable across env restarts)
        db.prepare('UPDATE users SET avatar_url = ? WHERE id = ?').run(relativePath, req.user.id);
        // Return full user object with absolute URL injected for immediate frontend use
        const user = db.prepare('SELECT id, username, avatar_color, avatar_url, is_superadmin FROM users WHERE id = ?').get(req.user.id);
        res.json({ ...user, avatar_url: absoluteUrl });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
