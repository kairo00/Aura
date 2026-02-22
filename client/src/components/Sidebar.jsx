import React, { useState, useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import ServerSettingsModal from './ServerSettingsModal'
import { extractDominantColor } from '../utils/dominantColor'

// Deterministic fallback color palette keyed by server name
const PALETTE = ['#6366f1', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#3b82f6']
function paletteColor(name) {
    if (!name) return PALETTE[0]
    let h = 0; for (const c of name) h = (h * 31 + c.charCodeAt(0)) & 0xffffffff
    return PALETTE[Math.abs(h) % PALETTE.length]
}

export default function Sidebar({ server, selectedChannel, onSelectChannel, unread, token, socket, pendingChannelId, onServerUpdated }) {
    const { user } = useAuth()
    const [channels, setChannels] = useState([])
    const [showAdd, setShowAdd] = useState(false)
    const [newName, setNewName] = useState('')
    const [adding, setAdding] = useState(false)
    const [copyFeedback, setCopyFeedback] = useState(false)
    const [showSettings, setShowSettings] = useState(false)
    const [dominantColor, setDominantColor] = useState(() => paletteColor(server?.name))

    // ── Extract dominant color whenever server icon changes ──────────────────
    useEffect(() => {
        if (server?.icon) {
            extractDominantColor(server.icon, paletteColor(server.name))
                .then(setDominantColor)
        } else {
            setDominantColor(paletteColor(server?.name))
        }
    }, [server?.icon, server?.name])

    const loadChannels = async () => {
        try {
            const res = await fetch(`/api/servers/${server.id}/channels`, { headers: { Authorization: `Bearer ${token}` } })
            const data = JSON.parse(await res.text())
            setChannels(data)
            if (data.length > 0) {
                const pending = pendingChannelId && data.find(c => String(c.id) === pendingChannelId)
                if (pending && !selectedChannel) {
                    onSelectChannel(pending)
                } else if (!selectedChannel) {
                    onSelectChannel(data[0])
                }
            }
        } catch (e) { console.error(e) }
    }

    useEffect(() => { if (server) loadChannels() }, [server?.id])

    useEffect(() => {
        if (!socket || !server) return
        const onChannelCreated = (ch) => {
            if (ch.server_id === server.id)
                setChannels(prev => prev.find(c => c.id === ch.id) ? prev : [...prev, ch])
        }
        socket.on('channel_created', onChannelCreated)
        return () => socket.off('channel_created', onChannelCreated)
    }, [socket, server?.id])

    const addChannel = async (e) => {
        e.preventDefault()
        if (!newName.trim() || adding) return
        setAdding(true)
        try {
            await fetch(`/api/servers/${server.id}/channels`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newName.trim() })
            })
            setNewName(''); setShowAdd(false)
        } catch (e) { console.error(e) }
        finally { setAdding(false) }
    }

    const copyInvite = async () => {
        try {
            const res = await fetch(`/api/servers/${server.id}/invites`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } })
            const data = JSON.parse(await res.text())
            if (data.code) {
                navigator.clipboard.writeText(`${window.location.origin}/join/${data.code}`)
                setCopyFeedback(true)
                setTimeout(() => setCopyFeedback(false), 2000)
            }
        } catch (e) { console.error(e) }
    }

    const leaveServer = async () => {
        if (!window.confirm(`Are you sure you want to leave ${server.name}?`)) return
        try {
            const res = await fetch(`/api/servers/${server.id}/members/me`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
            if (!res.ok) throw new Error((await res.json()).error)
            window.location.href = '/'
        } catch (e) { alert(e.message) }
    }

    // ── Banner gradient: use uploaded icon image, else dominant-color gradient ─
    const bannerStyle = server.icon
        ? {
            background: `linear-gradient(175deg, ${dominantColor}70 0%, rgba(0,0,0,0.9) 100%)`,
        }
        : {
            background: `linear-gradient(175deg, ${dominantColor}80 0%, rgba(0,0,0,0.92) 100%)`,
        }

    const iconBgStyle = server.icon
        ? { backgroundImage: `url(${server.icon})`, backgroundSize: 'cover', backgroundPosition: 'center' }
        : { background: dominantColor }

    // Glassmorphism action button style
    const glassBtn = {
        width: '2rem', height: '2rem',
        borderRadius: '999px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(255,255,255,0.1)',
        backdropFilter: 'blur(8px)',
        border: '1px solid rgba(255,255,255,0.15)',
        cursor: 'pointer',
        color: 'rgba(255,255,255,0.75)',
        transition: 'all 0.2s ease',
        flexShrink: 0
    }

    return (
        <div className="flex flex-col h-full overflow-hidden">

            {/* ── Server Banner ───────────────────────────────────────── */}
            <div className="flex-shrink-0 relative" style={{ ...bannerStyle, minHeight: '5.5rem', paddingBottom: '0.75rem' }}>
                {/* Top row: icon + action buttons */}
                <div className="flex items-start justify-between px-4 pt-4 pb-2">
                    {/* Server icon */}
                    <div className="w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center text-sm font-black text-white shadow-lg"
                        style={{
                            ...iconBgStyle,
                            boxShadow: `0 4px 18px ${dominantColor}66`,
                            border: '1px solid rgba(255,255,255,0.15)'
                        }}>
                        {!server.icon && server.name.slice(0, 2).toUpperCase()}
                    </div>

                    {/* Action buttons: Settings + Invite + Leave */}
                    <div className="flex items-center gap-1.5 mt-0.5">
                        {/* Leave Server */}
                        {server.owner_id !== user?.id && (
                            <button
                                onClick={leaveServer}
                                title="Leave Server"
                                style={glassBtn}
                                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.2)'; e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.4)' }}
                                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = 'rgba(255,255,255,0.75)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)' }}>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                                    <polyline points="16 17 21 12 16 7" />
                                    <line x1="21" y1="12" x2="9" y2="12" />
                                </svg>
                            </button>
                        )}
                        {/* Invite button */}
                        <button
                            onClick={copyInvite}
                            title={copyFeedback ? 'Link copied!' : 'Invite Friends'}
                            style={{
                                ...glassBtn,
                                ...(copyFeedback ? {
                                    background: 'rgba(100,210,130,0.2)',
                                    borderColor: 'rgba(100,210,130,0.4)',
                                    color: 'rgba(100,210,130,0.95)'
                                } : {})
                            }}
                            onMouseEnter={e => !copyFeedback && (e.currentTarget.style.background = 'rgba(255,255,255,0.18)')}
                            onMouseLeave={e => !copyFeedback && (e.currentTarget.style.background = 'rgba(255,255,255,0.1)')}>
                            {copyFeedback ? (
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="20 6 9 17 4 12" />
                                </svg>
                            ) : (
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                                    <circle cx="8.5" cy="7" r="4" />
                                    <line x1="20" y1="8" x2="20" y2="14" />
                                    <line x1="23" y1="11" x2="17" y2="11" />
                                </svg>
                            )}
                        </button>

                        {/* Settings button — Admin or High Role */}
                        {(server.owner_id === user?.id || server.role === 'Admin' || (server.role_position && server.role_position >= 500)) && (
                            <button
                                onClick={() => setShowSettings(true)}
                                title="Server Settings"
                                style={glassBtn}
                                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.18)'}
                                onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <circle cx="12" cy="12" r="3" />
                                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06-.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                                </svg>
                            </button>
                        )}
                    </div>
                </div>

                {/* Server name */}
                <div className="px-4">
                    <h2 className="font-serif-brand text-base font-semibold leading-tight truncate"
                        style={{ color: 'rgba(255,255,255,0.88)', textShadow: '0 1px 8px rgba(0,0,0,0.6)' }}>
                        {server.name}
                    </h2>
                    {server.role === 'Admin' && (
                        <span className="text-[10px] uppercase tracking-widest" style={{ color: `${dominantColor}`, opacity: 0.75 }}>Admin</span>
                    )}
                </div>
            </div>

            {/* ── Channels list ────────────────────────────────────────── */}
            <div className="flex-1 overflow-y-auto px-4 pt-4 pb-4">
                <div className="flex items-center justify-between px-2 mb-3">
                    <span className="text-xs font-semibold uppercase tracking-widest"
                        style={{ color: 'rgba(255,255,255,0.18)' }}>Channels</span>
                    <button onClick={() => setShowAdd(!showAdd)}
                        className="w-6 h-6 flex items-center justify-center rounded-full text-lg leading-none transition-colors"
                        style={{ color: 'rgba(255,255,255,0.22)' }}
                        onMouseEnter={e => e.currentTarget.style.color = 'rgba(255,255,255,0.65)'}
                        onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.22)'}>
                        +
                    </button>
                </div>

                {showAdd && (
                    <form onSubmit={addChannel} className="mb-4">
                        <input
                            autoFocus value={newName}
                            onChange={e => setNewName(e.target.value)}
                            placeholder="channel-name"
                            disabled={adding}
                            className="pill-input w-full px-5 py-2.5 text-sm"
                        />
                    </form>
                )}

                <div className="space-y-1">
                    {channels.map(ch => {
                        const count = unread[ch.id] || 0
                        const isActive = selectedChannel?.id === ch.id
                        return (
                            <button
                                key={ch.id}
                                onClick={() => onSelectChannel(ch)}
                                className={`nav-item w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left ${isActive ? 'active' : ''}`}
                            >
                                <span style={{ color: isActive ? 'rgba(255,255,255,0.38)' : 'rgba(255,255,255,0.14)', fontWeight: 400 }}>#</span>
                                <span className="flex-1 truncate">{ch.name}</span>
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

            {showSettings && server.role === 'Admin' && (
                <ServerSettingsModal
                    server={server}
                    onClose={() => setShowSettings(false)}
                    token={token}
                    onUpdate={(srv) => {
                        setShowSettings(false)
                        onServerUpdated?.(srv)
                    }}
                />
            )}
        </div>
    )
}
