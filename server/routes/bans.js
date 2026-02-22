const express = require('express')
const router = express.Router({ mergeParams: true })
const db = require('../db')
const authMiddleware = require('../middleware/auth')
const { requirePerm, getMembership } = require('../middleware/permissions')

router.use(authMiddleware)

// ── GET /api/servers/:serverId/bans ─────────────────────────────────────
// List bans (Admin or can_ban_members)
router.get('/', requirePerm('can_ban_members'), (req, res) => {
    const bans = db.prepare(`
        SELECT sb.*, u.username, u.avatar_color, u.avatar_url,
               bu.username AS banned_by_username
        FROM server_bans sb
        JOIN users u ON u.id = sb.user_id
        JOIN users bu ON bu.id = sb.banned_by
        WHERE sb.server_id = ?
        ORDER BY sb.banned_at DESC
    `).all(req.params.serverId)
    res.json(bans)
})

// ── POST /api/servers/:serverId/bans/:userId ────────────────────────────
// Ban a user
router.post('/:userId', requirePerm('can_ban_members'), (req, res) => {
    const { reason } = req.body
    const targetId = Number(req.params.userId)
    const serverId = Number(req.params.serverId)

    if (targetId === req.user.id) return res.status(400).json({ error: 'Cannot ban yourself' })

    // Cannot ban Admin
    const target = db.prepare('SELECT * FROM server_members WHERE server_id = ? AND user_id = ?')
        .get(serverId, targetId)
    if (!target) return res.status(404).json({ error: 'User is not a member' })
    if (target.role === 'Admin') return res.status(403).json({ error: 'Cannot ban an Admin' })

    // Permission check: only Admin can ban someone with a role_id
    const actor = getMembership(serverId, req.user.id)
    if (actor.role !== 'Admin' && target.role_id) {
        return res.status(403).json({ error: 'You cannot ban a role-holder; escalate to Admin' })
    }

    db.transaction(() => {
        // Remove from members
        db.prepare('DELETE FROM server_members WHERE server_id = ? AND user_id = ?').run(serverId, targetId)
        // Insert ban record
        db.prepare(`
            INSERT OR REPLACE INTO server_bans (server_id, user_id, banned_by, reason)
            VALUES (?, ?, ?, ?)
        `).run(serverId, targetId, req.user.id, reason || null)
    })()

    res.json({ ok: true })
})

// ── DELETE /api/servers/:serverId/bans/:userId ──────────────────────────
// Unban a user
router.delete('/:userId', requirePerm('can_ban_members'), (req, res) => {
    db.prepare('DELETE FROM server_bans WHERE server_id = ? AND user_id = ?')
        .run(req.params.serverId, req.params.userId)
    res.json({ ok: true })
})

// ── POST /api/servers/:serverId/bans/kick/:userId ────────────────────────
router.post('/kick/:userId', requirePerm('can_kick_members'), (req, res) => {
    const targetId = Number(req.params.userId)
    const serverId = Number(req.params.serverId)
    if (targetId === req.user.id) return res.status(400).json({ error: 'Cannot kick yourself' })

    const target = db.prepare('SELECT * FROM server_members WHERE server_id = ? AND user_id = ?')
        .get(serverId, targetId)
    if (!target) return res.status(404).json({ error: 'Member not found' })
    if (target.role === 'Admin') return res.status(403).json({ error: 'Cannot kick an Admin' })

    db.prepare('DELETE FROM server_members WHERE server_id = ? AND user_id = ?').run(serverId, targetId)
    res.json({ ok: true })
})

module.exports = router
