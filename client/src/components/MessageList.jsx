import React, { useEffect, useRef, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useSocket } from '../context/SocketContext'
import UserAvatar from './UserAvatar'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const COLORS = ['#6366f1', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#3b82f6']
const EMOJIS = ['👍', '❤️', '😂', '🔥', '🎉', '👀']

function getColor(name) {
    if (!name) return COLORS[0]
    let h = 0; for (let c of name) h = (h * 31 + c.charCodeAt(0)) & 0xffffffff
    return COLORS[Math.abs(h) % COLORS.length]
}
function fmtTime(iso) {
    return new Date(iso).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit', hour12: false })
}
function fmtDate(iso) {
    const d = new Date(iso), t = new Date()
    return d.toDateString() === t.toDateString()
        ? `Today ${fmtTime(iso)}`
        : d.toLocaleDateString('en', { month: 'short', day: 'numeric' }) + ' ' + fmtTime(iso)
}
function fmtLong(iso) {
    return new Date(iso).toLocaleDateString('en', { year: 'numeric', month: 'long', day: 'numeric' })
}

export default function MessageList({ messages, user, token, hasMore, onLoadMore, loadingMore, isDM, onDeleteMessage, userRole }) {
    const bottomRef = useRef(null)
    const prevLastId = useRef(null)
    const { onlineUsers } = useSocket()
    const [profileUser, setProfileUser] = useState(null)
    const [contextMenu, setContextMenu] = useState(null) // { x, y, msg }

    // Reaction API routes differ for DM vs channel
    const toggleReaction = async (messageId, emoji, hasReacted) => {
        const base = isDM ? `${API_URL}/api/dm/${messageId}/reactions` : `${API_URL}/api/channels/${messageId}/reactions`
        const method = hasReacted ? 'DELETE' : 'POST'
        const url = hasReacted ? `${base}/${encodeURIComponent(emoji)}` : base
        try {
            await fetch(url, {
                method,
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: hasReacted ? null : JSON.stringify({ emoji })
            })
        } catch (e) { console.error(e) }
    }

    useEffect(() => {
        const lastId = messages[messages.length - 1]?.id
        if (lastId !== prevLastId.current) {
            bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
            prevLastId.current = lastId
        }
    }, [messages])

    // Close context menu on click-away
    useEffect(() => {
        if (!contextMenu) return
        const close = () => setContextMenu(null)
        window.addEventListener('click', close)
        window.addEventListener('keydown', e => e.key === 'Escape' && close())
        return () => { window.removeEventListener('click', close) }
    }, [contextMenu])

    const handleRightClick = useCallback((e, msg) => {
        if (isDM) return // no delete for DMs yet
        e.preventDefault()
        const isAuthor = msg.user_id === user.id
        const isAdmin = userRole === 'Admin'
        const canManage = false // extended via props in future
        if (!isAuthor && !isAdmin && !canManage) return
        setContextMenu({ x: e.clientX, y: e.clientY, msg })
    }, [user.id, userRole, isDM])

    const deleteMessage = useCallback(async (msgId) => {
        setContextMenu(null)
        try {
            await fetch(`${API_URL}/api/channels/messages/${msgId}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` }
            })
            // Optimistic: also call the parent's handler if provided
            onDeleteMessage?.(msgId)
        } catch (e) { console.error(e) }
    }, [token, onDeleteMessage])

    if (messages.length === 0) return (
        <div className="flex-1 flex items-center justify-center">
            <span className="text-base" style={{ color: 'rgba(255,255,255,0.14)' }}>No messages yet</span>
        </div>
    )

    const grouped = messages.map((msg, i) => {
        const prev = messages[i - 1]
        const isGrouped = prev && prev.user_id === msg.user_id
            && (new Date(msg.created_at) - new Date(prev.created_at)) < 5 * 60 * 1000
        return { ...msg, isGrouped }
    })

    return (
        <>
            <div className="flex-1 overflow-y-auto px-10 py-6">
                {hasMore && (
                    <div className="flex justify-center pb-4">
                        <button onClick={onLoadMore} disabled={loadingMore} className="pill-btn text-sm px-6 py-2">
                            {loadingMore ? 'loading…' : '↑ earlier messages'}
                        </button>
                    </div>
                )}

                {grouped.map(msg => {
                    const r = msg.reactions || []
                    const byEmoji = r.reduce((acc, x) => {
                        acc[x.emoji] = acc[x.emoji] || []; acc[x.emoji].push(x.user_id); return acc
                    }, {})

                    return (
                        <div
                            key={msg.id}
                            className={`msg-in group relative flex gap-4 px-4 py-1.5 rounded-xl transition-colors duration-150 ${msg.isGrouped ? 'msg-group' : 'msg-new'}`}
                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.016)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                            onContextMenu={e => handleRightClick(e, msg)}
                        >
                            {/* Emoji quick-bar */}
                            <div className="emoji-bar absolute right-4 -top-6 hidden group-hover:flex z-20 px-1.5">
                                {EMOJIS.map(emoji => (
                                    <button key={emoji}
                                        onClick={() => toggleReaction(msg.id, emoji, (byEmoji[emoji] || []).includes(user.id))}
                                        className="px-2 py-1.5 text-base hover:scale-125 transition-transform rounded-full">
                                        {emoji}
                                    </button>
                                ))}
                            </div>

                            {/* Avatar col */}
                            <div className="w-10 flex-shrink-0 flex justify-center items-start pt-0.5">
                                {!msg.isGrouped ? (
                                    <button onClick={() => setProfileUser(msg)} className="relative">
                                        <UserAvatar user={msg} size={10}
                                            className="hover:scale-105 transition-transform duration-200"
                                        />
                                        {onlineUsers?.has(msg.user_id) && (
                                            <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-400 rounded-full border-2 border-black" />
                                        )}
                                    </button>
                                ) : (
                                    <span className="text-xs opacity-0 group-hover:opacity-100 transition-opacity mt-1"
                                        style={{ color: 'rgba(255,255,255,0.16)' }}>
                                        {fmtTime(msg.created_at)}
                                    </span>
                                )}
                            </div>

                            {/* Content */}
                            <div className="flex-1 min-w-0 pr-10">
                                {!msg.isGrouped && (
                                    <div className="flex items-baseline gap-3 mb-1">
                                        <span className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.75)' }}>
                                            {msg.username}
                                        </span>
                                        <span className="text-xs" style={{ color: 'rgba(255,255,255,0.20)' }}>
                                            {fmtDate(msg.created_at)}
                                        </span>
                                    </div>
                                )}
                                {msg.content && (
                                    <p className="text-base leading-relaxed break-words whitespace-pre-wrap"
                                        style={{ color: 'rgba(255,255,255,0.62)' }}>
                                        {msg.content}
                                    </p>
                                )}
                                {msg.attachment_url && (
                                    <div className="mt-2.5">
                                        <a href={msg.attachment_url} target="_blank" rel="noreferrer">
                                            <img src={msg.attachment_url} alt="attachment"
                                                className="max-h-64 rounded-2xl border hover:opacity-100 transition-opacity"
                                                style={{ borderColor: 'rgba(255,255,255,0.07)', opacity: 0.83 }} />
                                        </a>
                                    </div>
                                )}
                                {Object.keys(byEmoji).length > 0 && (
                                    <div className="flex flex-wrap gap-1.5 mt-2">
                                        {Object.entries(byEmoji).map(([emoji, uids]) => {
                                            const me = uids.includes(user.id)
                                            return (
                                                <button key={emoji} onClick={() => toggleReaction(msg.id, emoji, me)}
                                                    className={`reaction-pill text-sm px-3 py-1 flex items-center gap-1.5 ${me ? 'active' : ''}`}>
                                                    <span>{emoji}</span>
                                                    <span className="text-xs font-semibold">{uids.length}</span>
                                                </button>
                                            )
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>
                    )
                })}
                <div ref={bottomRef} />
            </div>

            {/* ── Right-click Context Menu ─────────────────────────────── */}
            {contextMenu && createPortal(
                <div
                    className="fixed z-[99999] rounded-xl shadow-2xl overflow-hidden"
                    style={{
                        top: contextMenu.y, left: contextMenu.x,
                        background: 'rgba(18,18,28,0.97)',
                        border: '1px solid rgba(255,255,255,0.08)',
                        minWidth: '160px',
                        backdropFilter: 'blur(12px)'
                    }}
                    onClick={e => e.stopPropagation()}>
                    <div className="px-3 py-2 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                        <p className="text-[10px] uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.2)' }}>Message</p>
                    </div>
                    <button
                        onClick={() => deleteMessage(contextMenu.msg.id)}
                        className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm font-medium transition-colors text-left"
                        style={{ color: 'rgba(255,100,100,0.9)' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,80,80,0.1)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4h6v2" />
                        </svg>
                        Delete message
                    </button>
                </div>,
                document.body
            )}

            {/* ── Cinematic Profile Card ─────────────────────────────────────── */}
            {profileUser && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-6"
                    style={{ background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(20px)' }}
                    onClick={() => setProfileUser(null)}>
                    <div className="profile-glass w-full max-w-sm"
                        onClick={e => e.stopPropagation()}>

                        {/* Cinematic banner — overflow visible so avatar can protrude */}
                        <div className="relative h-48 w-full rounded-t-[1.5rem]"
                            style={{
                                overflow: 'visible',
                                zIndex: 10,
                                background: profileUser?.avatar_url
                                    ? `linear-gradient(140deg, rgba(0,0,0,0.2) 0%, rgba(0,0,0,0.85) 100%), url('${API_URL}${profileUser.avatar_url}?v=profile') center/cover`
                                    : `linear-gradient(140deg, ${(profileUser?.avatar_color || getColor(profileUser?.username))}70 0%, rgba(0,0,0,0.85) 100%)`,
                                borderRadius: '1.5rem 1.5rem 0 0'
                            }}>
                            {/* Subtle grid texture on banner */}
                            <div className="absolute inset-0 opacity-30"
                                style={{
                                    backgroundImage: 'linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)',
                                    backgroundSize: '24px 24px'
                                }} />
                            {/* Radial glow from avatar color */}
                            <div className="absolute inset-0"
                                style={{
                                    background: `radial-gradient(ellipse at 30% 60%, ${(profileUser?.avatar_color || getColor(profileUser?.username))}40 0%, transparent 65%)`
                                }} />

                            {/* Large avatar — overflows banner intentionally, z-index keeps it on top */}
                            <div className="absolute -bottom-12 left-7" style={{ zIndex: 10 }}>
                                <div className="relative">
                                    <UserAvatar user={profileUser} size={24}
                                        className="rounded-3xl border-4 border-black shadow-2xl"
                                    />
                                    {onlineUsers?.has(profileUser.user_id) && (
                                        <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-emerald-400 rounded-full border-[3px] border-black" />
                                    )}
                                </div>
                            </div>

                            {/* Close button */}
                            <button onClick={() => setProfileUser(null)}
                                className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center text-base"
                                style={{ background: 'rgba(0,0,0,0.5)', color: 'rgba(255,255,255,0.45)' }}
                                onMouseEnter={e => e.currentTarget.style.color = '#fff'}
                                onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.45)'}>
                                ✕
                            </button>
                        </div>

                        {/* Profile body */}
                        <div className="px-7 pt-16 pb-7">
                            <div className="mb-6">
                                <h2 className="font-serif-brand text-3xl font-semibold tracking-tight"
                                    style={{ color: 'rgba(255,255,255,0.88)' }}>
                                    {profileUser.username}
                                </h2>
                                <p className="mt-1 text-sm"
                                    style={{ color: onlineUsers?.has(profileUser.user_id) ? 'rgba(100,210,130,0.85)' : 'rgba(255,255,255,0.28)' }}>
                                    {onlineUsers?.has(profileUser.user_id) ? '● Online' : '○ Offline'}
                                </p>
                            </div>

                            <div className="pt-5" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                                <div className="text-xs uppercase tracking-widest mb-1.5" style={{ color: 'rgba(255,255,255,0.2)' }}>
                                    Member since
                                </div>
                                <div className="text-base" style={{ color: 'rgba(255,255,255,0.52)' }}>
                                    {profileUser.created_at ? fmtLong(profileUser.created_at) : 'Unknown'}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}
