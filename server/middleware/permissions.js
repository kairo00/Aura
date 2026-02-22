/**
 * Permission middleware factory.
 * Usage: requirePerm('can_kick_members')
 *
 * Attaches req.membership (server_members row) and req.serverRole (server_roles row | null)
 * to the request object for downstream use.
 */
const db = require('../db')

// Resolve the most powerful role for a member in a server
function getMembership(serverId, userId) {
    return db.prepare(`
        SELECT sm.*, sr.position, sr.can_manage_messages, sr.can_kick_members,
               sr.can_ban_members, sr.can_manage_roles, sr.can_manage_channels
        FROM server_members sm
        LEFT JOIN server_roles sr ON sr.id = sm.role_id
        WHERE sm.server_id = ? AND sm.user_id = ?
    `).get(serverId, userId)
}

/**
 * requirePerm(perm) — middleware
 * Requires the calling user to be an Admin OR have the given permission in the server.
 * Expects :serverId or :id as the route param for the server.
 */
function requirePerm(perm) {
    return (req, res, next) => {
        const serverId = req.params.serverId || req.params.id
        const membership = getMembership(serverId, req.user.id)

        if (!membership) return res.status(403).json({ error: 'Not a member of this server' })

        req.membership = membership

        // Admins bypass all permission checks
        if (membership.role === 'Admin') return next()

        // Check the role's specific permission
        if (perm && !membership[perm]) {
            return res.status(403).json({ error: `Missing permission: ${perm}` })
        }

        next()
    }
}

/**
 * requireAdmin — middleware
 * Requires the calling user to be an Admin of the server.
 */
function requireAdmin(req, res, next) {
    const serverId = req.params.serverId || req.params.id
    const membership = getMembership(serverId, req.user.id)
    if (!membership || membership.role !== 'Admin') {
        return res.status(403).json({ error: 'Server admin required' })
    }
    req.membership = membership
    next()
}

/**
 * requireSuperAdmin — middleware
 * Requires the calling user to have is_superadmin = 1 in the users table.
 */
function requireSuperAdmin(req, res, next) {
    const u = db.prepare('SELECT is_superadmin FROM users WHERE id = ?').get(req.user.id)
    if (!u || !u.is_superadmin) return res.status(403).json({ error: 'Super-admin access required' })
    next()
}

module.exports = { requirePerm, requireAdmin, requireSuperAdmin, getMembership }
