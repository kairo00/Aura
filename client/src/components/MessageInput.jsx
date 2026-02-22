import React, { useState, useRef } from 'react'

export default function MessageInput({ placeholder, onSend, onTyping, token, user }) {
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
    const [value, setValue] = useState('')
    const [fileUrl, setFileUrl] = useState(null)
    const [uploading, setUploading] = useState(false)
    const fileInputRef = useRef(null)
    const typingRef = useRef(false)
    const stopTimer = useRef(null)

    const handleFileChange = async (e) => {
        const file = e.target.files?.[0]
        if (!file) return
        setUploading(true)
        const fd = new FormData(); fd.append('image', file)
        try {
            const res = await fetch(`${API_URL}/api/channels/upload`, {
                method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd
            })
            const data = JSON.parse(await res.text())
            if (data.url) setFileUrl(data.url)
        } catch (e) { console.error(e) }
        finally { setUploading(false); if (fileInputRef.current) fileInputRef.current.value = '' }
    }

    const handleChange = (e) => {
        setValue(e.target.value)
        if (!typingRef.current) { typingRef.current = true; onTyping(true) }
        clearTimeout(stopTimer.current)
        stopTimer.current = setTimeout(() => { typingRef.current = false; onTyping(false) }, 2000)
    }

    const submit = () => {
        const trimmed = value.trim()
        if (!trimmed && !fileUrl) return
        onSend(trimmed, fileUrl)
        setValue(''); setFileUrl(null)
        clearTimeout(stopTimer.current); typingRef.current = false; onTyping(false)
    }

    const hasContent = !!value.trim() || !!fileUrl

    return (
        <div className="px-5 pb-5 flex-shrink-0">
            {fileUrl && (
                <div className="mb-3 relative inline-block">
                    <img src={fileUrl} className="h-20 rounded-2xl border" alt="Preview"
                        style={{ borderColor: 'rgba(255,255,255,0.07)', opacity: 0.8 }} />
                    <button onClick={() => setFileUrl(null)}
                        className="absolute -top-2 -right-2 w-6 h-6 rounded-full border flex items-center justify-center transition-colors"
                        style={{ background: '#000', borderColor: 'rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.5)', fontSize: '0.75rem' }}
                        onMouseEnter={e => e.currentTarget.style.color = '#fff'}
                        onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.5)'}>
                        ×
                    </button>
                </div>
            )}

            <div className="flex items-center gap-2">
                {/* User Avatar */}
                {user && (
                    <div className="w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold text-white border"
                        style={user?.avatar_url ? {
                            background: `url('${API_URL}${user.avatar_url.includes('?') ? user.avatar_url + '&v=user' : user.avatar_url + '?v=user'}') center/cover`,
                            color: 'transparent',
                            borderColor: 'rgba(255,255,255,0.07)'
                        } : {
                            background: user?.avatar_color || '#6366f1',
                            borderColor: 'transparent'
                        }}>
                        {!user?.avatar_url && user?.username?.slice(0, 2).toUpperCase()}
                    </div>
                )}

                {/* Attach */}
                <button onClick={() => fileInputRef.current?.click()} disabled={uploading}
                    data-tip="Attach image"
                    className="w-10 h-10 rounded-full border flex-shrink-0 flex items-center justify-center transition-all duration-200"
                    style={{ borderColor: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.22)' }}
                    onMouseEnter={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.65)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.18)' }}
                    onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.22)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)' }}>
                    {uploading
                        ? <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                        : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" /></svg>
                    }
                </button>
                <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />

                {/* Pill input + send */}
                <div className="flex-1 pill-input flex items-center pr-1.5 pl-5 gap-2"
                    style={{ borderColor: hasContent ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.07)' }}>
                    <input
                        type="text" value={value}
                        onChange={handleChange}
                        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit() } }}
                        placeholder={placeholder}
                        className="flex-1 bg-transparent py-3.5 text-base focus:outline-none"
                        style={{ color: 'rgba(255,255,255,0.75)' }}
                    />
                    <button onClick={submit} disabled={!hasContent || uploading} data-tip="Send"
                        className="w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center border transition-all duration-250 disabled:opacity-25"
                        style={{
                            borderColor: hasContent ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.07)',
                            color: hasContent ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.16)',
                            background: hasContent ? 'rgba(255,255,255,0.08)' : 'transparent',
                            boxShadow: hasContent ? '0 0 12px rgba(255,255,255,0.06)' : 'none',
                        }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M2 21L23 12 2 3v7l15 2-15 2z" /></svg>
                    </button>
                </div>
            </div>
        </div>
    )
}
