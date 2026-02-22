const express = require('express')
const router = express.Router({ mergeParams: true }) // gives access to :serverId
const db = require('../db')
const authMiddleware = require('../middleware/auth')
const { requireAdmin, requirePerm } = require('../middleware/permissions')

// All routes require auth
router.use(authMiddleware)

// ── GET /api/servers/:serverId/roles ────────────────────────────────────
// List all roles for a server (any member can view)
router.get('/', requirePerm(null), (req, res) => {
    const roles = db.prepare('SELECT * FROM server_roles WHERE server_id = ? ORDER BY position DESC').all(req.params.serverId)
    res.json(roles)
})

// ── POST /api/servers/:serverId/roles ───────────────────────────────────
// Create a new role (Admin only)
router.post('/', requireAdmin, (req, res) => {
    const { name, color = '#99aab5', position = 0, can_manage_messages = 0, can_kick_members = 0,
        can_ban_members = 0, can_manage_roles = 0, can_manage_channels = 0 } = req.body
    if (!name?.trim()) return res.status(400).json({ error: 'Role name required' })
    try {
        const info = db.prepare(`
            INSERT INTO server_roles (server_id, name, color, position,
                can_manage_messages, can_kick_members, can_ban_members, can_manage_roles, can_manage_channels)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(req.params.serverId, name.trim(), color, position,
            can_manage_messages ? 1 : 0, can_kick_members ? 1 : 0,
            can_ban_members ? 1 : 0, can_manage_roles ? 1 : 0, can_manage_channels ? 1 : 0)
        res.json(db.prepare('SELECT * FROM server_roles WHERE id = ?').get(info.lastInsertRowid))
    } catch (e) {
        res.status(400).json({ error: e.message })
    }
})

// ── PATCH /api/servers/:serverId/roles/:roleId ──────────────────────────
// Update a role's permissions/name/color (Admin only)
router.patch('/:roleId', requireAdmin, (req, res) => {
    const { name, color, position, can_manage_messages, can_kick_members,
        can_ban_members, can_manage_roles, can_manage_channels } = req.body
    const role = db.prepare('SELECT * FROM server_roles WHERE id = ? AND server_id = ?')
        .get(req.params.roleId, req.params.serverId)
    if (!role) return res.status(404).json({ error: 'Role not found' })
    db.prepare(`
        UPDATE server_roles SET
            name = COALESCE(?, name),
            color = COALESCE(?, color),
            position = COALESCE(?, position),
            can_manage_messages = COALESCE(?, can_manage_messages),
            can_kick_members    = COALESCE(?, can_kick_members),
            can_ban_members     = COALESCE(?, can_ban_members),
            can_manage_roles    = COALESCE(?, can_manage_roles),
            can_manage_channels = COALESCE(?, can_manage_channels)
        WHERE id = ?
    `).run(name, color,
        position !== undefined ? position : null,
        can_manage_messages !== undefined ? (can_manage_messages ? 1 : 0) : null,
        can_kick_members !== undefined ? (can_kick_members ? 1 : 0) : null,
        can_ban_members !== undefined ? (can_ban_members ? 1 : 0) : null,
        can_manage_roles !== undefined ? (can_manage_roles ? 1 : 0) : null,
        can_manage_channels !== undefined ? (can_manage_channels ? 1 : 0) : null,
        req.params.roleId)
    res.json(db.prepare('SELECT * FROM server_roles WHERE id = ?').get(req.params.roleId))
})

// ── DELETE /api/servers/:serverId/roles/:roleId ─────────────────────────
router.delete('/:roleId', requireAdmin, (req, res) => {
    const role = db.prepare('SELECT * FROM server_roles WHERE id = ? AND server_id = ?')
        .get(req.params.roleId, req.params.serverId)
    if (!role) return res.status(404).json({ error: 'Role not found' })
    db.prepare('DELETE FROM server_roles WHERE id = ?').run(req.params.roleId)
    res.json({ ok: true })
})

// ── PATCH /api/servers/:serverId/roles/assign/:userId ───────────────────
// Assign a role to a member (Admin OR can_manage_roles)
router.patch('/assign/:userId', requirePerm('can_manage_roles'), (req, res) => {
    const { role_id } = req.body
    const member = db.prepare('SELECT * FROM server_members WHERE server_id = ? AND user_id = ?')
        .get(req.params.serverId, req.params.userId)
    if (!member) return res.status(404).json({ error: 'Member not found' })
    if (member.role === 'Admin') return res.status(403).json({ error: 'Cannot change role of Admin' })
    // Validate the role belongs to this server
    if (role_id) {
        const role = db.prepare('SELECT * FROM server_roles WHERE id = ? AND server_id = ?')
            .get(role_id, req.params.serverId)
        if (!role) return res.status(400).json({ error: 'Role not found in this server' })
    }
    db.prepare('UPDATE server_members SET role_id = ? WHERE server_id = ? AND user_id = ?')
        .run(role_id || null, req.params.serverId, req.params.userId)
    res.json({ ok: true })
})

module.exports = router
