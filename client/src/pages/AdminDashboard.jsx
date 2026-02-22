import React, { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

function getColor(name) {
    const C = ['#6366f1', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#3b82f6']
    if (!name) return C[0]
    let h = 0; for (const c of name) h = (h * 31 + c.charCodeAt(0)) & 0xffffffff
    return C[Math.abs(h) % C.length]
}

export default function AdminDashboard() {
    const { user, token } = useAuth()
    const navigate = useNavigate()
    const [tab, setTab] = useState('users')
    const [users, setUsers] = useState([])
    const [servers, setServers] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [search, setSearch] = useState('')
    const [confirmDelete, setConfirmDelete] = useState(null) // { type: 'user'|'server', id, name }

    const load = useCallback(async () => {
        setLoading(true); setError('')
        try {
            const [ur, sr] = await Promise.all([
                fetch(`${API_URL}/api/admin/users`, { headers: { Authorization: `Bearer ${token}` } }),
                fetch(`${API_URL}/api/admin/servers`, { headers: { Authorization: `Bearer ${token}` } })
            ])
            if (ur.status === 403) { navigate('/'); return }
            setUsers(await ur.json())
            setServers(await sr.json())
        } catch (e) { setError(e.message) }
        finally { setLoading(false) }
    }, [token, navigate])

    useEffect(() => { load() }, [load])

    const deleteUser = async (id) => {
        try {
            const r = await fetch(`${API_URL}/api/admin/users/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
            const d = await r.json()
            if (!r.ok) throw new Error(d.error)
            setUsers(prev => prev.filter(u => u.id !== id))
            setConfirmDelete(null)
        } catch (e) { setError(e.message); setConfirmDelete(null) }
    }

    const deleteServer = async (id) => {
        try {
            const r = await fetch(`${API_URL}/api/admin/servers/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
            const d = await r.json()
            if (!r.ok) throw new Error(d.error)
            setServers(prev => prev.filter(s => s.id !== id))
            setConfirmDelete(null)
        } catch (e) { setError(e.message); setConfirmDelete(null) }
    }

    const filteredUsers = users.filter(u =>
        u.username.toLowerCase().includes(search.toLowerCase())
    )

    const TABS = [
        { key: 'users', label: `Users (${users.length})` },
        { key: 'servers', label: `Servers (${servers.length})` },
    ]

    return (
        <div className="min-h-screen flex flex-col" style={{ background: '#080810' }}>
            {/* Cinematic grid */}
            <div aria-hidden="true" style={{
                position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none',
                backgroundImage: ['linear-gradient(rgba(255,255,255,0.025) 1px,transparent 1px)', 'linear-gradient(90deg,rgba(255,255,255,0.025) 1px,transparent 1px)'].join(','),
                backgroundSize: '80px 80px',
            }} />

            {/* Header */}
            <div className="relative z-10 flex items-center justify-between px-8 py-5 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' }}>
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate('/')} className="text-xs font-semibold transition-colors" style={{ color: 'rgba(255,255,255,0.3)' }}
                        onMouseEnter={e => e.currentTarget.style.color = 'rgba(255,255,255,0.7)'}
                        onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.3)'}>
                        ← Back to App
                    </button>
                    <div className="w-px h-4" style={{ background: 'rgba(255,255,255,0.08)' }} />
                    <h1 className="font-serif-brand text-xl font-semibold" style={{ color: 'rgba(255,255,255,0.85)' }}>
                        ⚙ Super Admin
                    </h1>
                </div>
                <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
                        style={{ background: user?.avatar_color || getColor(user?.username), color: '#fff' }}>
                        {user?.username?.slice(0, 1).toUpperCase()}
                    </div>
                    <span className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>{user?.username}</span>
                </div>
            </div>

            <div className="relative z-10 flex-1 px-8 py-8 max-w-6xl mx-auto w-full">
                {/* Stats */}
                <div className="grid grid-cols-3 gap-4 mb-8">
                    {[
                        { label: 'Total Users', value: users.length, color: '#6366f1' },
                        { label: 'Total Servers', value: servers.length, color: '#10b981' },
                        { label: 'Total Messages', value: users.reduce((s, u) => s + (u.message_count || 0), 0).toLocaleString(), color: '#f59e0b' },
                    ].map(s => (
                        <div key={s.label} className="rounded-2xl p-6" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                            <div className="text-3xl font-black mb-1" style={{ color: s.color }}>{s.value}</div>
                            <div className="text-xs uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.3)' }}>{s.label}</div>
                        </div>
                    ))}
                </div>

                {/* Tabs */}
                <div className="flex gap-1 p-1 mb-6 rounded-xl w-fit" style={{ background: 'rgba(255,255,255,0.04)' }}>
                    {TABS.map(t => (
                        <button key={t.key} onClick={() => setTab(t.key)}
                            className="px-5 py-2 rounded-lg text-xs font-semibold uppercase tracking-widest transition-all"
                            style={tab === t.key ? { background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.85)' } : { color: 'rgba(255,255,255,0.3)' }}>
                            {t.label}
                        </button>
                    ))}
                </div>

                {error && (
                    <div className="mb-4 px-4 py-2.5 rounded-xl text-sm" style={{ background: 'rgba(255,80,80,0.08)', color: 'rgba(255,100,100,0.85)', border: '1px solid rgba(255,100,100,0.2)' }}>
                        {error}
                    </div>
                )}

                {loading ? (
                    <div className="flex justify-center py-16">
                        <div className="w-8 h-8 rounded-full border-2 animate-spin" style={{ borderColor: 'rgba(255,255,255,0.1)', borderTopColor: '#6366f1' }} />
                    </div>
                ) : tab === 'users' ? (
                    <div>
                        <input value={search} onChange={e => setSearch(e.target.value)}
                            placeholder="Search users…" className="pill-input w-full max-w-sm px-5 py-2.5 text-sm mb-4" />
                        <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
                            <table className="w-full text-sm">
                                <thead>
                                    <tr style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                                        {['User', 'Servers', 'Messages', 'Joined', 'Actions'].map(h => (
                                            <th key={h} className="px-5 py-3.5 text-left text-xs uppercase tracking-widest font-semibold" style={{ color: 'rgba(255,255,255,0.25)' }}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredUsers.map((u, i) => (
                                        <tr key={u.id} style={{ borderTop: i > 0 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}
                                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                            <td className="px-5 py-3.5">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold"
                                                        style={u?.avatar_url ? { background: `url('${API_URL}${u.avatar_url}?v=admin') center/cover`, color: 'transparent' } : { background: u?.avatar_color || getColor(u?.username) }}>
                                                        {!u?.avatar_url && u?.username?.slice(0, 1).toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <div className="font-medium" style={{ color: 'rgba(255,255,255,0.8)' }}>
                                                            {u.username}
                                                            {u.is_superadmin ? <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded-md font-bold uppercase" style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b' }}>Admin</span> : null}
                                                        </div>
                                                        <div className="text-[11px]" style={{ color: 'rgba(255,255,255,0.2)' }}>ID: {u.id}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-5 py-3.5" style={{ color: 'rgba(255,255,255,0.45)' }}>{u.server_count}</td>
                                            <td className="px-5 py-3.5" style={{ color: 'rgba(255,255,255,0.45)' }}>{u.message_count?.toLocaleString()}</td>
                                            <td className="px-5 py-3.5 text-xs" style={{ color: 'rgba(255,255,255,0.25)' }}>
                                                {new Date(u.created_at).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })}
                                            </td>
                                            <td className="px-5 py-3.5">
                                                {!u.is_superadmin && u.id !== user?.id && (
                                                    <button onClick={() => setConfirmDelete({ type: 'user', id: u.id, name: u.username })}
                                                        className="text-xs font-semibold transition-colors"
                                                        style={{ color: 'rgba(255,100,100,0.5)' }}
                                                        onMouseEnter={e => e.currentTarget.style.color = 'rgba(255,100,100,0.9)'}
                                                        onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,100,100,0.5)'}>
                                                        Delete
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ) : (
                    <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
                        <table className="w-full text-sm">
                            <thead>
                                <tr style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                                    {['Server', 'Owner', 'Members', 'Channels', 'Created', 'Actions'].map(h => (
                                        <th key={h} className="px-5 py-3.5 text-left text-xs uppercase tracking-widest font-semibold" style={{ color: 'rgba(255,255,255,0.25)' }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {servers.map((s, i) => (
                                    <tr key={s.id} style={{ borderTop: i > 0 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}
                                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                        <td className="px-5 py-3.5">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-xl flex-shrink-0 flex items-center justify-center text-xs font-bold"
                                                    style={s.icon ? { background: `url(${s.icon}) center/cover`, color: 'transparent' } : { background: getColor(s.name) }}>
                                                    {!s.icon && s.name.slice(0, 2).toUpperCase()}
                                                </div>
                                                <span className="font-medium" style={{ color: 'rgba(255,255,255,0.8)' }}>{s.name}</span>
                                            </div>
                                        </td>
                                        <td className="px-5 py-3.5" style={{ color: 'rgba(255,255,255,0.45)' }}>{s.owner_username}</td>
                                        <td className="px-5 py-3.5" style={{ color: 'rgba(255,255,255,0.45)' }}>{s.member_count}</td>
                                        <td className="px-5 py-3.5 text-xs" style={{ color: 'rgba(255,255,255,0.25)' }}>
                                            {new Date(s.created_at).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })}
                                        </td>
                                        <td className="px-5 py-3.5">
                                            <button onClick={() => setConfirmDelete({ type: 'server', id: s.id, name: s.name })}
                                                className="text-xs font-semibold transition-colors"
                                                style={{ color: 'rgba(255,100,100,0.5)' }}
                                                onMouseEnter={e => e.currentTarget.style.color = 'rgba(255,100,100,0.9)'}
                                                onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,100,100,0.5)'}>
                                                Delete
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Delete confirm modal */}
            {confirmDelete && (
                <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(12px)' }}
                    onClick={() => setConfirmDelete(null)}>
                    <div className="rounded-2xl p-8 max-w-sm w-full mx-4" style={{ background: 'rgba(18,18,28,0.98)', border: '1px solid rgba(255,100,100,0.2)' }}
                        onClick={e => e.stopPropagation()}>
                        <h3 className="text-lg font-bold mb-2" style={{ color: 'rgba(255,100,100,0.9)' }}>Delete {confirmDelete.name}?</h3>
                        <p className="text-sm mb-6" style={{ color: 'rgba(255,255,255,0.4)' }}>
                            This will permanently delete the {confirmDelete.type} and all associated data. This cannot be undone.
                        </p>
                        <div className="flex gap-2">
                            <button onClick={() => confirmDelete.type === 'server' ? deleteServer(confirmDelete.id) : deleteUser(confirmDelete.id)}
                                className="pill-btn flex-1 py-2.5 text-sm font-bold"
                                style={{ background: 'rgba(255,80,80,0.15)', color: 'rgba(255,100,100,0.95)', borderColor: 'rgba(255,100,100,0.4)' }}>
                                Confirm Delete
                            </button>
                            <button onClick={() => setConfirmDelete(null)} className="pill-btn flex-1 py-2.5 text-sm">
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
