import React, { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { extractDominantColor } from '../utils/dominantColor'

const COLORS = ['#6366f1', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#3b82f6']
function getColor(name) {
    if (!name) return COLORS[0]
    let h = 0; for (let c of name) h = (h * 31 + c.charCodeAt(0)) & 0xffffffff
    return COLORS[Math.abs(h) % COLORS.length]
}

export default function ServerSettingsModal({ server, onClose, token, onUpdate }) {
    const defaultBgColor = getColor(server.name)
    const [tab, setTab] = useState('general') // 'general' | 'roles'
    const [name, setName] = useState(server.name)
    const [icon, setIcon] = useState(server.icon)
    const [glowColor, setGlowColor] = useState(defaultBgColor)
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)
    const [uploading, setUploading] = useState(false)
    const [confirmDelete, setConfirmDelete] = useState(false)
    const fileInputRef = useRef(null)

    // ── Roles state ─────────────────────────────────────────────────────
    const [roles, setRoles] = useState([])
    const [rolesLoading, setRolesLoading] = useState(false)
    const [newRoleName, setNewRoleName] = useState('')
    const [newRoleColor, setNewRoleColor] = useState('#6366f1')

    useEffect(() => {
        if (icon) {
            extractDominantColor(icon, defaultBgColor).then(setGlowColor)
        } else {
            setGlowColor(defaultBgColor)
        }
    }, [icon, defaultBgColor])

    const loadRoles = async () => {
        setRolesLoading(true)
        try {
            const r = await fetch(`/api/servers/${server.id}/roles`, { headers: { Authorization: `Bearer ${token}` } })
            setRoles(await r.json())
        } catch (e) { console.error(e) }
        finally { setRolesLoading(false) }
    }

    useEffect(() => { if (tab === 'roles') loadRoles() }, [tab])

    const createRole = async () => {
        if (!newRoleName.trim()) return
        try {
            const r = await fetch(`/api/servers/${server.id}/roles`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newRoleName.trim(), color: newRoleColor })
            })
            const data = await r.json()
            if (!r.ok) throw new Error(data.error)
            setRoles(prev => [...prev, data])
            setNewRoleName('')
        } catch (e) { setError(e.message) }
    }

    const togglePerm = async (role, perm) => {
        const newVal = role[perm] ? 0 : 1
        // Optimistic update
        setRoles(prev => prev.map(r => r.id === role.id ? { ...r, [perm]: newVal } : r))
        try {
            await fetch(`/api/servers/${server.id}/roles/${role.id}`, {
                method: 'PATCH',
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ [perm]: newVal })
            })
        } catch (e) { console.error(e); loadRoles() } // revert on failure
    }

    const deleteRole = async (roleId) => {
        if (!confirm('Delete this role?')) return
        setRoles(prev => prev.filter(r => r.id !== roleId))
        try {
            await fetch(`/api/servers/${server.id}/roles/${roleId}`, {
                method: 'DELETE', headers: { Authorization: `Bearer ${token}` }
            })
        } catch (e) { console.error(e); loadRoles() }
    }

    const saveName = async () => {
        if (!name.trim() || name.trim() === server.name) return
        setError('')
        setLoading(true)
        try {
            const res = await fetch(`/api/servers/${server.id}`, {
                method: 'PATCH',
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: name.trim() })
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error)
            onUpdate(data) // update server state upstream
        } catch (e) {
            setError(e.message)
        } finally {
            setLoading(false)
        }
    }

    const uploadIcon = async (e) => {
        const file = e.target.files?.[0]
        if (!file) return
        setError('')
        setUploading(true)
        const fd = new FormData()
        fd.append('image', file)
        try {
            const res = await fetch(`/api/servers/${server.id}/upload`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
                body: fd
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error)
            const bustIcon = `${data.icon}?t=${Date.now()}`
            setIcon(bustIcon)
            onUpdate({ ...data, icon: bustIcon }) // data is the updated server object from DB
        } catch (err) {
            setError('Failed to upload image')
        } finally {
            setUploading(false)
            e.target.value = ''
        }
    }

    const deleteServer = async () => {
        try {
            setLoading(true)
            const res = await fetch(`/api/servers/${server.id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` }
            })
            if (!res.ok) throw new Error((await res.json()).error)
            onUpdate(null) // pass null upstream to navigate home
        } catch (e) {
            setError(e.message)
            setLoading(false)
            setConfirmDelete(false)
        }
    }

    return createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.78)', backdropFilter: 'blur(16px)' }}
            onClick={onClose}>
            <div className="profile-glass w-full max-w-sm pt-10 pb-8 px-10" onClick={e => e.stopPropagation()}>

                <div className="mb-8 pl-1">
                    <h2 className="font-serif-brand text-2xl font-semibold tracking-tight" style={{ color: 'rgba(255,255,255,0.92)' }}>
                        Server Settings
                    </h2>
                    <p className="mt-2 text-sm" style={{ color: 'rgba(255,255,255,0.38)' }}>Manage your space</p>
                </div>

                {/* Tab switcher */}
                <div className="flex gap-1 p-1 mb-6 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)' }}>
                    {['general', 'roles'].map(t => (
                        <button key={t} onClick={() => { setTab(t); setError('') }}
                            className="flex-1 py-2 rounded-lg text-xs font-semibold uppercase tracking-widest capitalize transition-all"
                            style={tab === t ? {
                                background: 'rgba(255,255,255,0.1)',
                                color: 'rgba(255,255,255,0.85)'
                            } : {
                                color: 'rgba(255,255,255,0.3)'
                            }}>
                            {t}
                        </button>
                    ))}
                </div>
                {/* ── General tab ── */}
                {tab === 'general' && (
                    <div className="space-y-8 pl-1">
                        {/* Icon Upload area */}
                        <div className="flex flex-col items-start">
                            <div className="relative group cursor-pointer w-24 h-24 rounded-[1.5rem] transition-transform hover:scale-105 overflow-hidden"
                                onClick={() => fileInputRef.current?.click()}
                                style={{
                                    background: icon ? `url('${import.meta.env.VITE_API_URL}${icon}') center/cover` : defaultBgColor,
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    boxShadow: `0 8px 32px ${glowColor}66`
                                }}>
                                {!icon && (
                                    <div className="absolute inset-0 flex items-center justify-center font-black text-white text-3xl">
                                        {server.name.slice(0, 2).toUpperCase()}
                                    </div>
                                )}
                                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center pointer-events-none">
                                    {uploading ? (
                                        <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                                    ) : (
                                        <>
                                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-white mb-1">
                                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />
                                            </svg>
                                            <span className="text-[10px] font-bold text-white uppercase tracking-wider">Upload</span>
                                        </>
                                    )}
                                </div>
                            </div>
                            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={uploadIcon} />
                            <span className="mt-4 text-xs font-semibold uppercase tracking-widest pl-1" style={{ color: 'rgba(255,255,255,0.25)' }}>Server Icon</span>
                        </div>

                        {/* Server Name input */}
                        <div>
                            <label className="block text-xs font-semibold uppercase tracking-widest mb-3 pl-1" style={{ color: 'rgba(255,255,255,0.25)' }}>
                                Server Name
                            </label>
                            <input
                                value={name} onChange={e => setName(e.target.value)}
                                className="pill-input w-full px-5 py-3 text-sm font-medium"
                                placeholder="Community Name"
                            />
                        </div>
                    </div>
                )}

                {/* ── Roles tab ── */}
                {tab === 'roles' && (
                    <div>
                        {rolesLoading ? (
                            <div className="flex justify-center py-8">
                                <div className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'rgba(255,255,255,0.15)', borderTopColor: 'transparent' }} />
                            </div>
                        ) : (
                            <div className="space-y-3 mb-6">
                                {roles.length === 0 && (
                                    <p className="text-sm text-center py-4" style={{ color: 'rgba(255,255,255,0.2)' }}>No roles yet</p>
                                )}
                                {roles.map(role => (
                                    <div key={role.id} className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                                        <div className="flex items-center gap-2 mb-3">
                                            <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: role.color }} />
                                            <span className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.8)' }}>{role.name}</span>
                                            <button onClick={() => deleteRole(role.id)} className="ml-auto text-xs transition-colors" style={{ color: 'rgba(255,100,100,0.4)' }}
                                                onMouseEnter={e => e.currentTarget.style.color = 'rgba(255,100,100,0.85)'}
                                                onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,100,100,0.4)'}>
                                                Delete
                                            </button>
                                        </div>
                                        <div className="grid grid-cols-2 gap-y-2 gap-x-4">
                                            {[
                                                ['can_manage_messages', 'Manage Messages'],
                                                ['can_kick_members', 'Kick Members'],
                                                ['can_ban_members', 'Ban Members'],
                                                ['can_manage_roles', 'Manage Roles'],
                                                ['can_manage_channels', 'Manage Channels'],
                                            ].map(([perm, label]) => (
                                                <label key={perm} className="flex items-center gap-2 cursor-pointer">
                                                    <div onClick={() => togglePerm(role, perm)}
                                                        className="w-8 h-4 rounded-full relative transition-colors flex-shrink-0"
                                                        style={{ background: role[perm] ? role.color : 'rgba(255,255,255,0.1)', cursor: 'pointer' }}>
                                                        <div className="absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-all"
                                                            style={{ left: role[perm] ? 'calc(100% - 14px)' : '2px' }} />
                                                    </div>
                                                    <span className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>{label}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                        {/* Create new role */}
                        <div className="flex gap-2 items-center">
                            <div className="w-7 h-7 rounded-full flex-shrink-0 cursor-pointer border overflow-hidden relative" style={{ background: newRoleColor, borderColor: 'rgba(255,255,255,0.1)' }}>
                                <input type="color" value={newRoleColor} onChange={e => setNewRoleColor(e.target.value)}
                                    className="absolute inset-0 opacity-0 w-full h-full cursor-pointer" />
                            </div>
                            <input value={newRoleName} onChange={e => setNewRoleName(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && createRole()}
                                placeholder="New role name…"
                                className="pill-input flex-1 px-4 py-2 text-sm" />
                            <button onClick={createRole} disabled={!newRoleName.trim()}
                                className="pill-btn py-2 px-4 text-sm disabled:opacity-30">Create</button>
                        </div>
                    </div>
                )}

                {error && (
                    <div className="mt-6 text-sm px-4 py-2.5 rounded-xl border text-center"
                        style={{ color: 'rgba(255,100,100,0.85)', borderColor: 'rgba(255,100,100,0.25)', background: 'rgba(255,80,80,0.06)' }}>
                        {error}
                    </div>
                )}

                <div className="mt-10 pt-6" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                    {confirmDelete ? (
                        <div className="p-4 rounded-xl border" style={{ borderColor: 'rgba(255,100,100,0.25)', background: 'rgba(255,80,80,0.06)' }}>
                            <p className="text-sm font-medium mb-4 text-center" style={{ color: 'rgba(255,100,100,0.9)' }}>
                                Delete this server forever?
                            </p>
                            <div className="flex gap-2">
                                <button onClick={deleteServer} disabled={loading} className="pill-btn flex-1 py-2 text-sm font-bold"
                                    style={{ background: 'rgba(255,80,80,0.15)', color: 'rgba(255,100,100,0.95)', borderColor: 'rgba(255,100,100,0.4)' }}>
                                    {loading ? 'Deleting…' : 'Delete'}
                                </button>
                                <button onClick={() => setConfirmDelete(false)} disabled={loading} className="pill-btn flex-1 py-2 text-sm">
                                    Cancel
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-3">
                            <div className="flex gap-3">
                                <button onClick={saveName} disabled={loading || name.trim() === server.name} className="pill-btn pill-btn-primary flex-1 py-3 text-sm">
                                    {loading ? 'saving…' : 'Save Changes'}
                                </button>
                                <button onClick={onClose} disabled={loading} className="pill-btn px-6 py-3 text-sm">Close</button>
                            </div>
                            <button onClick={() => setConfirmDelete(true)} disabled={loading} className="pill-btn w-full py-3 text-sm mt-2 transition-colors"
                                style={{ color: 'rgba(255,100,100,0.6)', borderColor: 'rgba(255,100,100,0.2)' }}
                                onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(255,100,100,0.4)'; e.currentTarget.style.color = 'rgba(255,100,100,0.9)'; }}
                                onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,100,100,0.2)'; e.currentTarget.style.color = 'rgba(255,100,100,0.6)'; }}>
                                Delete Server
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div >,
        document.body
    )
}
