const express = require('express')
const router = express.Router()
const db = require('../db')
const authMiddleware = require('../middleware/auth')
const { requireSuperAdmin } = require('../middleware/permissions')

router.use(authMiddleware)
router.use(requireSuperAdmin)

// ── GET /api/admin/users ─────────────────────────────────────────────────
router.get('/users', (req, res) => {
    const users = db.prepare(`
        SELECT id, username, avatar_color, avatar_url, is_superadmin, created_at,
            (SELECT COUNT(*) FROM server_members sm WHERE sm.user_id = users.id) AS server_count,
            (SELECT COUNT(*) FROM messages m WHERE m.user_id = users.id) AS message_count
        FROM users
        ORDER BY created_at DESC
    `).all()
    res.json(users)
})

// ── DELETE /api/admin/users/:id ──────────────────────────────────────────
router.delete('/users/:id', (req, res) => {
    const target = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id)
    if (!target) return res.status(404).json({ error: 'User not found' })
    if (target.is_superadmin) return res.status(403).json({ error: 'Cannot delete a super-admin' })
    if (Number(req.params.id) === req.user.id) return res.status(400).json({ error: 'Cannot delete yourself' })
    db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id)
    res.json({ ok: true })
})

// ── GET /api/admin/servers ───────────────────────────────────────────────
router.get('/servers', (req, res) => {
    const servers = db.prepare(`
        SELECT s.*, u.username AS owner_username,
            (SELECT COUNT(*) FROM server_members sm WHERE sm.server_id = s.id) AS member_count,
            (SELECT COUNT(*) FROM channels c WHERE c.server_id = s.id) AS channel_count
        FROM servers s JOIN users u ON u.id = s.owner_id
        ORDER BY s.created_at DESC
    `).all()
    res.json(servers)
})

// ── DELETE /api/admin/servers/:id ──────────────────────────────────────────
router.delete('/servers/:id', (req, res) => {
    const target = db.prepare('SELECT * FROM servers WHERE id = ?').get(req.params.id)
    if (!target) return res.status(404).json({ error: 'Server not found' })

    db.transaction(() => {
        db.prepare('DELETE FROM messages WHERE channel_id IN (SELECT id FROM channels WHERE server_id = ?)').run(target.id)
        db.prepare('DELETE FROM channels WHERE server_id = ?').run(target.id)
        db.prepare('DELETE FROM invites WHERE server_id = ?').run(target.id)
        db.prepare('DELETE FROM server_members WHERE server_id = ?').run(target.id)
        db.prepare('DELETE FROM servers WHERE id = ?').run(target.id)
    })()
    res.json({ ok: true })
})

// ── DELETE /api/admin/messages/:id ──────────────────────────────────────
router.delete('/messages/:id', (req, res) => {
    const msg = db.prepare('SELECT * FROM messages WHERE id = ?').get(req.params.id)
    if (!msg) return res.status(404).json({ error: 'Message not found' })
    db.prepare('DELETE FROM messages WHERE id = ?').run(req.params.id)
    res.json({ ok: true })
})

module.exports = router
