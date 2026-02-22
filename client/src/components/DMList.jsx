import React, { useState, useEffect } from 'react'
import { useSocket } from '../context/SocketContext'
import UserAvatar from './UserAvatar'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

function getColor(name) {
    const C = ['#6366f1', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#3b82f6']
    if (!name) return C[0]
    let h = 0; for (let c of name) h = (h * 31 + c.charCodeAt(0)) & 0xffffffff
    return C[Math.abs(h) % C.length]
}

export default function DMList({ selectedDM, onSelectDM, unread, token }) {
    const { onlineUsers } = useSocket()
    const [threads, setThreads] = useState([])
    const [users, setUsers] = useState([])
    const [search, setSearch] = useState('')
    const [searchOpen, setSearchOpen] = useState(false)

    const load = async () => {
        try {
            const [t, u] = await Promise.all([
                fetch(`${API_URL}/api/dm`, { headers: { Authorization: `Bearer ${token}` } })
                    .then(async r => JSON.parse(await r.text())),
                fetch(`${API_URL}/api/users`, { headers: { Authorization: `Bearer ${token}` } })
                    .then(async r => JSON.parse(await r.text()))
            ])
            setThreads(Array.isArray(t) ? t : [])
            setUsers(Array.isArray(u) ? u : [])
        } catch (e) { console.error(e) }
    }

    useEffect(() => { load() }, [])

    const startDM = async (user) => {
        try {
            const res = await fetch(`${API_URL}/api/dm/${user.id}`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } })
            const thread = JSON.parse(await res.text())
            setSearchOpen(false); setSearch('')
            load()
            onSelectDM({ threadId: thread.id, partner: user })
        } catch (e) { console.error(e) }
    }

    const filtered = search ? users.filter(u => u.username.toLowerCase().includes(search.toLowerCase())) : []

    return (
        <div className="flex flex-col h-full overflow-hidden">
            {/* Header */}
            <div className="px-6 pt-7 pb-5 flex-shrink-0">
                <h2 className="font-serif-brand text-xl font-semibold mb-4" style={{ color: 'rgba(255,255,255,0.72)' }}>Messages</h2>

                {/* Search toggle — single pill button, no duplication */}
                {!searchOpen ? (
                    <button
                        onClick={() => setSearchOpen(true)}
                        className="pill-input w-full px-5 py-2.5 text-sm text-left"
                        style={{ color: 'rgba(255,255,255,0.22)', cursor: 'text' }}>
                        Find someone…
                    </button>
                ) : (
                    <div className="relative">
                        <input
                            autoFocus
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            onBlur={() => { if (!search) setSearchOpen(false) }}
                            placeholder="Search users…"
                            className="pill-input w-full px-5 py-2.5 text-sm pr-8"
                        />
                        <button
                            onClick={() => { setSearchOpen(false); setSearch('') }}
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-sm leading-none"
                            style={{ color: 'rgba(255,255,255,0.28)' }}>
                            ✕
                        </button>
                    </div>
                )}

                {/* Search results dropdown */}
                {searchOpen && search && (
                    <div className="mt-2 space-y-0.5">
                        {filtered.map(u => (
                            <button key={u.id} onClick={() => startDM(u)}
                                className="nav-item w-full flex items-center gap-3 px-4 py-2.5 text-sm">
                                <div className="relative flex-shrink-0">
                                    <UserAvatar user={u} size={7} />
                                    {onlineUsers?.has(u.id) && (
                                        <div className="absolute -bottom-px -right-px w-2 h-2 bg-emerald-400 rounded-full border border-black" />
                                    )}
                                </div>
                                <span className="truncate">{u.username}</span>
                            </button>
                        ))}
                        {filtered.length === 0 && (
                            <p className="text-sm px-4 py-2" style={{ color: 'rgba(255,255,255,0.22)' }}>No users found.</p>
                        )}
                    </div>
                )}
            </div>

            {/* Thread list */}
            <div className="flex-1 overflow-y-auto px-4 pb-4">
                <div className="px-2 mb-3">
                    <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.18)' }}>Direct</span>
                </div>
                {threads.length === 0 && (
                    <p className="px-4 text-sm" style={{ color: 'rgba(255,255,255,0.2)' }}>No conversations yet.</p>
                )}
                <div className="space-y-1">
                    {threads.map(t => {
                        const count = unread[`dm_${t.id}`] || 0
                        const isSelected = selectedDM?.threadId === t.id
                        const isOnline = onlineUsers?.has(t.partner_id)
                        return (
                            <button key={t.id}
                                onClick={() => onSelectDM({
                                    threadId: t.id, partner: {
                                        id: t.partner_id,
                                        username: t.partner_username,
                                        avatar_color: t.partner_avatar_color,
                                        avatar_url: t.partner_avatar_url
                                    }
                                })}
                                className={`nav-item w-full flex items-center gap-3 px-4 py-2.5 text-sm ${isSelected ? 'active' : ''}`}>
                                <div className="relative flex-shrink-0">
                                    <UserAvatar user={{ username: t.partner_username, avatar_url: t.partner_avatar_url, avatar_color: t.partner_avatar_color }} size={7} />
                                    {isOnline && <div className="absolute -bottom-px -right-px w-2 h-2 bg-emerald-400 rounded-full border border-black" />}
                                </div>
                                <span className="flex-1 text-left truncate">{t.partner_username}</span>
                                {count > 0 && (
                                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                                        style={{ color: 'rgba(255,255,255,0.7)', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)' }}>
                                        {count > 99 ? '99+' : count}
                                    </span>
                                )}
                            </button>
                        )
                    })}
                </div>
            </div>
        </div>
    )
}
