const router = require('express').Router();
const db = require('../db');
const authMiddleware = require('../middleware/auth');
const crypto = require('crypto');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure uploads directory exists to avoid "Failed to upload" error
const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir)
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname))
    }
});
const upload = multer({ storage: storage });

// Get all servers for current user
router.get('/', authMiddleware, (req, res) => {
    const servers = db.prepare(`
    SELECT s.*, sm.role, sr.position AS role_position 
    FROM servers s
    JOIN server_members sm ON s.id = sm.server_id
    LEFT JOIN server_roles sr ON sm.role_id = sr.id
    WHERE sm.user_id = ?
    ORDER BY s.created_at
  `).all(req.user.id);
    res.json(servers);
});

// Create a server
router.post('/', authMiddleware, (req, res) => {
    const { name, icon } = req.body;
    if (!name) return res.status(400).json({ error: 'Name required' });
    const result = db.prepare('INSERT INTO servers (name, owner_id, icon) VALUES (?, ?, ?)').run(name, req.user.id, icon || null);
    const serverId = result.lastInsertRowid;
    // Add owner as member with Admin role
    db.prepare('INSERT INTO server_members (server_id, user_id, role) VALUES (?, ?, ?)').run(serverId, req.user.id, 'Admin');
    // Create default channel
    db.prepare('INSERT INTO channels (server_id, name) VALUES (?, ?)').run(serverId, 'général');
    const server = db.prepare('SELECT * FROM servers WHERE id = ?').get(serverId);
    server.role = 'Admin';
    const io = req.app.get('io');
    if (io) io.to(`user:${req.user.id}`).emit('server_created', server);
    res.status(201).json(server);
});

// Update server name
router.patch('/:id', authMiddleware, (req, res) => {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Name required' });

    const member = db.prepare('SELECT role FROM server_members WHERE server_id = ? AND user_id = ?').get(req.params.id, req.user.id);
    if (!member || member.role !== 'Admin') return res.status(403).json({ error: 'Not authorized' });

    db.prepare('UPDATE servers SET name = ? WHERE id = ?').run(name, req.params.id);
    const server = db.prepare('SELECT * FROM servers WHERE id = ?').get(req.params.id);
    server.role = 'Admin';
    res.json(server);
});

// Upload server icon
router.post('/:id/upload', authMiddleware, upload.single('image'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const member = db.prepare('SELECT role FROM server_members WHERE server_id = ? AND user_id = ?').get(req.params.id, req.user.id);
    if (!member || member.role !== 'Admin') return res.status(403).json({ error: 'Not authorized' });

    const iconUrl = `/uploads/${req.file.filename}`;
    db.prepare('UPDATE servers SET icon = ? WHERE id = ?').run(iconUrl, req.params.id);
    const server = db.prepare('SELECT * FROM servers WHERE id = ?').get(req.params.id);
    server.role = 'Admin';
    res.json(server);
});

// Delete a server
router.delete('/:id', authMiddleware, (req, res) => {
    try {
        const serverId = req.params.id;
        const member = db.prepare('SELECT role FROM server_members WHERE server_id = ? AND user_id = ?').get(serverId, req.user.id);
        if (!member || member.role !== 'Admin') {
            return res.status(403).json({ error: 'Only admins can delete the server' });
        }

        db.transaction(() => {
            // Delete messages in all channels of this server
            db.prepare('DELETE FROM messages WHERE channel_id IN (SELECT id FROM channels WHERE server_id = ?)').run(serverId);
            // Delete channels
            db.prepare('DELETE FROM channels WHERE server_id = ?').run(serverId);
            // Delete invites
            db.prepare('DELETE FROM invites WHERE server_id = ?').run(serverId);
            // Delete server members
            db.prepare('DELETE FROM server_members WHERE server_id = ?').run(serverId);
            // Delete the server itself
            db.prepare('DELETE FROM servers WHERE id = ?').run(serverId);
        })();

        // Notify others if needed (optional, could emit a 'server_deleted' event)
        res.json({ success: true });
    } catch (e) {
        console.error('Failed to delete server:', e);
        res.status(500).json({ error: e.message });
    }
});

// Get channels for a server
router.get('/:id/channels', authMiddleware, (req, res) => {
    const channels = db.prepare('SELECT * FROM channels WHERE server_id = ? ORDER BY id').all(req.params.id);
    res.json(channels);
});

// Create a channel
router.post('/:id/channels', authMiddleware, (req, res) => {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Name required' });
    const result = db.prepare('INSERT INTO channels (server_id, name) VALUES (?, ?)').run(req.params.id, name.toLowerCase().replace(/\s+/g, '-'));
    const channel = db.prepare('SELECT * FROM channels WHERE id = ?').get(result.lastInsertRowid);

    const io = req.app.get('io');
    if (io) {
        const members = db.prepare('SELECT user_id FROM server_members WHERE server_id = ?').all(req.params.id);
        members.forEach(m => io.to(`user:${m.user_id}`).emit('channel_created', channel));
    }

    res.status(201).json(channel);
});

// Get members of a server (with roles, online status, and ban-safe)
router.get('/:id/members', authMiddleware, (req, res) => {
    // Require membership
    const self = db.prepare('SELECT role FROM server_members WHERE server_id = ? AND user_id = ?').get(req.params.id, req.user.id)
    if (!self) return res.status(403).json({ error: 'Not a member' })

    const members = db.prepare(`
        SELECT u.id, u.username, u.avatar_color, u.avatar_url,
               sm.role, sm.role_id,
               sr.name AS role_name, sr.color AS role_color, sr.position AS role_position,
               sr.can_manage_messages, sr.can_kick_members, sr.can_ban_members,
               sr.can_manage_roles, sr.can_manage_channels
        FROM users u
        JOIN server_members sm ON u.id = sm.user_id
        LEFT JOIN server_roles sr ON sr.id = sm.role_id
        WHERE sm.server_id = ?
        ORDER BY COALESCE(sr.position, -1) DESC, u.username ASC
    `).all(req.params.id)
    res.json(members)
})

// Create an invite for a server (Admin only)
router.post('/:id/invites', authMiddleware, (req, res) => {
    const member = db.prepare('SELECT role FROM server_members WHERE server_id = ? AND user_id = ?').get(req.params.id, req.user.id);
    if (!member || member.role !== 'Admin') return res.status(403).json({ error: 'Requires Admin role' });

    const code = crypto.randomBytes(4).toString('hex');
    db.prepare('INSERT INTO invites (code, server_id, created_by) VALUES (?, ?, ?)').run(code, req.params.id, req.user.id);
    res.json({ code });
});

// Join a server via invite code
router.post('/join/:code', authMiddleware, (req, res) => {
    const invite = db.prepare('SELECT * FROM invites WHERE code = ?').get(req.params.code);
    if (!invite) return res.status(404).json({ error: 'Invalid invite code' });

    // Check ban first
    const ban = db.prepare('SELECT 1 FROM server_bans WHERE server_id = ? AND user_id = ?').get(invite.server_id, req.user.id)
    if (ban) return res.status(403).json({ error: 'You are banned from this server' })

    try {
        db.prepare('INSERT OR IGNORE INTO server_members (server_id, user_id, role) VALUES (?, ?, ?)').run(invite.server_id, req.user.id, 'Member');
        db.prepare('UPDATE invites SET uses = uses + 1 WHERE code = ?').run(req.params.code);

        const server = db.prepare(`
            SELECT s.*, sm.role FROM servers s
            JOIN server_members sm ON s.id = sm.server_id
            WHERE s.id = ? AND sm.user_id = ?
        `).get(invite.server_id, req.user.id);

        const io = req.app.get('io');
        if (io) io.to(`user:${req.user.id}`).emit('server_joined', server);

        res.json({ server });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// Leave a server
router.delete('/:id/members/me', authMiddleware, (req, res) => {
    try {
        const server = db.prepare('SELECT owner_id FROM servers WHERE id = ?').get(req.params.id);
        if (!server) return res.status(404).json({ error: 'Server not found' });
        if (server.owner_id === req.user.id) {
            return res.status(400).json({ error: 'Owner cannot leave the server. Transfer ownership or delete the server instead.' });
        }
        db.prepare('DELETE FROM server_members WHERE server_id = ? AND user_id = ?').run(req.params.id, req.user.id);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Assign a role to a member
router.put('/:id/members/:uid/role', authMiddleware, (req, res) => {
    try {
        const { role_id } = req.body;
        const targetUserId = Number(req.params.uid);

        // Rule A: Cannot change own role
        if (targetUserId === req.user.id) {
            return res.status(403).json({ error: 'You cannot change your own role' });
        }

        const server = db.prepare('SELECT owner_id FROM servers WHERE id = ?').get(req.params.id);
        if (!server) return res.status(404).json({ error: 'Server not found' });

        // Helper to calculate numeric role position
        const getPos = (userId) => {
            if (server.owner_id === userId) return 1000;
            const m = db.prepare(`
                SELECT sm.role, sr.position 
                FROM server_members sm 
                LEFT JOIN server_roles sr ON sm.role_id = sr.id 
                WHERE sm.server_id = ? AND sm.user_id = ?
            `).get(req.params.id, userId);
            if (!m) return -1;
            if (m.role === 'Admin') return 500;
            return m.position || 0;
        };

        const myPos = getPos(req.user.id);
        const targetPos = getPos(targetUserId);

        // Basic permission check: only Admin/Owner (for now) can manage roles
        if (myPos < 500) {
            return res.status(403).json({ error: 'Only admins or the owner can assign roles' });
        }

        // Rule B: Cannot modify someone with an equal or higher role
        if (myPos <= targetPos) {
            return res.status(403).json({ error: 'Cannot modify a member with an equal or higher role' });
        }

        let newRolePos = 0;
        if (role_id) {
            const roleObj = db.prepare('SELECT position FROM server_roles WHERE id = ? AND server_id = ?').get(role_id, req.params.id);
            if (!roleObj) return res.status(400).json({ error: 'Invalid role' });
            newRolePos = roleObj.position;
        }

        // Rule C: Cannot assign a role equal to or higher than own role
        if (myPos <= newRolePos) {
            return res.status(403).json({ error: 'Cannot assign a role equal to or higher than your own' });
        }

        db.prepare('UPDATE server_members SET role_id = ? WHERE server_id = ? AND user_id = ?').run(role_id || null, req.params.id, targetUserId);
        res.json({ success: true });
    } catch (e) {
        console.error("PUT role error:", e.message);
        res.status(500).json({ error: e.message });
    }
});

// Get roles for a server
router.get('/:id/roles', authMiddleware, (req, res) => {
    try {
        const roles = db.prepare('SELECT * FROM server_roles WHERE server_id = ? ORDER BY position DESC').all(req.params.id);
        res.json(roles);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
