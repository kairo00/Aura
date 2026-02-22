/**
 * UserAvatar — single source of truth for rendering any user's avatar.
 *
 * Props:
 *   user        : object with { username, avatar_url?, avatar_color? }
 *   size        : Tailwind size token digit, e.g. 8 → w-8 h-8   (default 8)
 *   className   : extra Tailwind classes to append
 *   cacheKey    : bump this number to force a fresh image load (e.g. after upload)
 */
import React from 'react'

const PALETTE = ['#6366f1', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#3b82f6']
function hashColor(name = '') {
    let h = 0
    for (const c of name) h = (h * 31 + c.charCodeAt(0)) & 0xffffffff
    return PALETTE[Math.abs(h) % PALETTE.length]
}

/** Returns the canonical absolute URL for an avatar path */
export function avatarSrc(avatar_url, cacheKey = '') {
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
    if (!avatar_url) return null
    // If already absolute, return as-is (with optional cache-bust)
    if (avatar_url.startsWith('http')) {
        return cacheKey ? `${avatar_url.split('?')[0]}?v=${cacheKey}` : avatar_url
    }
    const base = avatar_url.split('?')[0]
    return cacheKey ? `${API_URL}${base}?v=${cacheKey}` : `${API_URL}${base}`
}

export default function UserAvatar({ user, size = 8, className = '', cacheKey = '' }) {
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
    const src = user?.avatar_url ? avatarSrc(user.avatar_url, cacheKey) : null
    const color = user?.avatar_color || hashColor(user?.username)
    const initials = (user?.username || '?').slice(0, 2).toUpperCase()
    const dim = `w-${size} h-${size}`

    return (
        <div
            className={`${dim} rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold text-white overflow-hidden ${className}`}
            style={src ? {
                backgroundImage: `url('${src}')`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                color: 'transparent',
            } : { background: color }}
        >
            {!src && initials}
        </div>
    )
}
