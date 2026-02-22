import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { extractDominantColor } from '../utils/dominantColor'
import UserAvatar, { avatarSrc } from './UserAvatar'


const COLORS = ['#6366f1', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#3b82f6']

export default function SettingsModal({ onClose, token }) {
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
    const { user, updateUser, logout } = useAuth()
    const navigate = useNavigate()

    // ── profile form state ───────────────────────────────────────────────────
    const [username, setUsername] = useState(user.username)
    const [color, setColor] = useState(user.avatar_color)

    // ── avatar preview state ─────────────────────────────────────────────────
    // avatarSrc is the canonical absolute URL returned by the backend.
    // We drive the preview from the live user object in AuthContext — no
    // separate duplicate state needed — but we need a cacheKey to bust the
    // browser cache after a new file is uploaded.
    const [cacheKey, setCacheKey] = useState(Date.now())
    const [glowColor, setGlowColor] = useState(user.avatar_color)

    // ── ui state ─────────────────────────────────────────────────────────────
    const [uploading, setUploading] = useState(false)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [confirmDelete, setConfirmDelete] = useState(false)
    const fileInputRef = useRef(null)

    // Recompute glow whenever the displayed avatar changes
    useEffect(() => {
        const src = user.avatar_url ? avatarSrc(user.avatar_url, cacheKey) : null
        if (src) {
            extractDominantColor(src, color).then(setGlowColor)
        } else {
            setGlowColor(color)
        }
    }, [user.avatar_url, cacheKey, color])

    // ── upload handler (decoupled — saves to DB immediately) ─────────────────
    const handleUpload = async (e) => {
        const file = e.target.files?.[0]
        if (!file) return

        setUploading(true)
        setError('')
        const fd = new FormData()
        fd.append('image', file)

        try {
            const res = await fetch(`${API_URL}/api/users/me/upload`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
                body: fd,
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Upload failed')

            // data.avatar_url is already the full absolute URL from the backend.
            // Push it to global AuthContext so every component re-renders.
            updateUser({ ...data, avatar_url: data.avatar_url })
            // Bump cache key to force the preview box to re-fetch the image.
            setCacheKey(Date.now())
        } catch (err) {
            setError(err.message || 'Failed to upload image')
        } finally {
            setUploading(false)
            e.target.value = ''
        }
    }

    // ── save handler (username + color only) ─────────────────────────────────
    const save = async () => {
        setError('')
        setLoading(true)
        try {
            const res = await fetch(`${API_URL}/api/users/me`, {
                method: 'PATCH',
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                // Send the raw path stored in the DB (no query params, no absolute prefix)
                body: JSON.stringify({
                    username,
                    avatar_color: color,
                    // Clear avatar_url if user picked a new color swatch
                    avatar_url: user.avatar_url || null,
                }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error)
            updateUser(data)
            onClose()
        } catch (e) {
            setError(e.message)
            setLoading(false)
        }
    }

    const deleteAccount = async () => {
        try {
            setLoading(true)
            const res = await fetch(`${API_URL}/api/users/me`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` },
            })
            if (!res.ok) throw new Error((await res.json()).error)
            logout()
        } catch (e) {
            setError(e.message)
            setLoading(false)
            setConfirmDelete(false)
        }
    }

    // Build the preview src: use the live user.avatar_url from AuthContext.
    const previewSrc = user.avatar_url ? avatarSrc(user.avatar_url, cacheKey) : null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.78)', backdropFilter: 'blur(16px)' }}
            onClick={onClose}>
            <div className="profile-glass w-full max-w-sm p-10" onClick={e => e.stopPropagation()}>

                {/* Title row */}
                <div className="flex items-center justify-between mb-7">
                    <h2 className="font-serif-brand text-xl font-semibold" style={{ color: 'rgba(255,255,255,0.68)' }}>Settings</h2>
                    <button onClick={onClose} data-tip="Close"
                        className="w-7 h-7 flex items-center justify-center rounded-full text-base leading-none transition-colors"
                        style={{ color: 'rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.04)' }}
                        onMouseEnter={e => e.currentTarget.style.color = 'rgba(255,255,255,0.7)'}
                        onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.2)'}>
                        ✕
                    </button>
                </div>

                {/* ── Avatar upload (saves immediately, no secondary button) ─── */}
                <div className="flex justify-center mb-8">
                    <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                        {/* Preview — driven by user.avatar_url + cacheKey */}
                        <div
                            className="rounded-3xl overflow-hidden flex items-center justify-center text-3xl font-bold text-white transition-all duration-300"
                            style={{
                                width: '5.5rem', height: '5.5rem',
                                background: previewSrc ? `url('${previewSrc}') center/cover` : color,
                                boxShadow: `0 0 36px ${glowColor}70`,
                            }}
                        >
                            {!previewSrc && username.slice(0, 2).toUpperCase()}
                        </div>

                        {/* Hover overlay */}
                        <div className="absolute inset-0 bg-black/60 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center pointer-events-none">
                            {uploading ? (
                                <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                            ) : (
                                <>
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-white mb-1">
                                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />
                                    </svg>
                                    <span className="text-[10px] font-bold text-white uppercase tracking-wider">Upload</span>
                                </>
                            )}
                        </div>

                        <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleUpload} />
                    </div>
                </div>

                {/* ── Form fields ─────────────────────────────────────────── */}
                <div className="space-y-8">
                    <div>
                        <label className="block text-xs uppercase tracking-widest mb-2.5" style={{ color: 'rgba(255,255,255,0.2)' }}>
                            Username
                        </label>
                        <input value={username} onChange={e => setUsername(e.target.value)}
                            className="pill-input w-full px-5 py-3 text-sm" />
                    </div>
                    <div>
                        <label className="block text-xs uppercase tracking-widest mb-3" style={{ color: 'rgba(255,255,255,0.2)' }}>
                            Avatar color
                        </label>
                        <div className="flex gap-4 flex-wrap">
                            {COLORS.map(c => (
                                <button key={c}
                                    onClick={() => {
                                        setColor(c)
                                        // Clear avatar photo: PATCH will save null avatar_url
                                        updateUser({ ...user, avatar_url: null, avatar_color: c })
                                    }}
                                    className="w-9 h-9 rounded-full transition-all duration-250 hover:scale-110"
                                    style={{
                                        background: c,
                                        opacity: color === c ? 1 : 0.48,
                                        transform: color === c ? 'scale(1.18)' : undefined,
                                        boxShadow: color === c ? `0 0 14px ${c}99` : 'none',
                                        outline: color === c ? '2px solid rgba(255,255,255,0.38)' : 'none',
                                        outlineOffset: '3px',
                                    }} />
                            ))}
                        </div>
                    </div>
                </div>

                {error && (
                    <div className="mt-4 text-sm px-4 py-2.5 rounded-full border"
                        style={{ color: 'rgba(255,100,100,0.78)', borderColor: 'rgba(255,100,100,0.15)', background: 'rgba(255,80,80,0.04)' }}>
                        {error}
                    </div>
                )}

                {confirmDelete ? (
                    <div className="mt-8 p-5 rounded-2xl border"
                        style={{ borderColor: 'rgba(255,100,100,0.3)', background: 'rgba(255,80,80,0.06)' }}>
                        <p className="text-sm font-medium mb-4 text-center" style={{ color: 'rgba(255,100,100,0.9)' }}>
                            Are you absolutely sure? This cannot be undone.
                        </p>
                        <div className="flex gap-2.5">
                            <button onClick={deleteAccount} disabled={loading} className="pill-btn flex-1 py-2.5 text-sm font-bold"
                                style={{ background: 'rgba(255,80,80,0.15)', color: 'rgba(255,100,100,0.95)', borderColor: 'rgba(255,100,100,0.4)' }}>
                                {loading ? 'Deleting…' : 'Yes, delete it'}
                            </button>
                            <button onClick={() => setConfirmDelete(false)} disabled={loading} className="pill-btn flex-1 py-2.5 text-sm">
                                Cancel
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col gap-2.5 mt-8">
                        {user.is_superadmin ? (
                            <button onClick={() => navigate('/admin')} className="pill-btn py-3 px-5 text-sm font-bold flexitems-center justify-center transition-all duration-300 transform hover:scale-[1.02]"
                                style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)', color: '#fff', boxShadow: '0 4px 14px rgba(245, 158, 11, 0.4)' }}>
                                👑 Open Admin Dashboard
                            </button>
                        ) : null}
                        <div className="flex gap-2.5">
                            <button onClick={save} disabled={loading} className="pill-btn pill-btn-primary flex-1 py-3 text-sm">
                                {loading ? 'saving…' : 'Save changes'}
                            </button>
                            <button onClick={logout} className="pill-btn py-3 px-5 text-sm font-semibold transition-colors flex-shrink-0"
                                style={{ color: 'rgba(255,100,100,0.85)', background: 'rgba(255,80,80,0.08)', borderColor: 'rgba(255,100,100,0.2)' }}
                                onMouseEnter={e => { e.currentTarget.style.color = 'rgba(255,200,200,1)'; e.currentTarget.style.background = 'rgba(255,80,80,0.18)' }}
                                onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,100,100,0.85)'; e.currentTarget.style.background = 'rgba(255,80,80,0.08)' }}>
                                Sign out
                            </button>
                        </div>
                    </div>
                )}

                {!confirmDelete && (
                    <div className="mt-6 pt-5 flex justify-center" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                        <button onClick={() => setConfirmDelete(true)} className="text-xs font-semibold tracking-wide transition-colors"
                            style={{ color: 'rgba(255,100,100,0.4)' }}
                            onMouseEnter={e => e.currentTarget.style.color = 'rgba(255,100,100,0.8)'}
                            onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,100,100,0.4)'}>
                            DELETE ACCOUNT
                        </button>
                    </div>
                )}
            </div>
        </div>
    )
}
