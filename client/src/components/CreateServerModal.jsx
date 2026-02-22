import React, { useState, useRef } from 'react'

export default function CreateServerModal({ onClose, onCreate, token }) {
    const [name, setName] = useState('')
    const [iconUrl, setIconUrl] = useState('')
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)
    const [uploading, setUploading] = useState(false)
    const fileInputRef = useRef(null)

    const create = async (e) => {
        e.preventDefault()
        if (!name.trim() || loading || uploading) return
        setError('')
        setLoading(true)
        try {
            // onCreate handles the fetch; now pass iconUrl too
            await onCreate(name.trim(), iconUrl)
        } catch (e) {
            setError(e.message)
            setLoading(false)
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(12px)' }}
            onClick={onClose}>
            <div className="profile-glass w-full max-w-xs p-8" onClick={e => e.stopPropagation()}>
                <div className="text-center mb-7">
                    {/* Server Icon Upload Block */}
                    <div className="relative group cursor-pointer w-16 h-16 rounded-2xl mx-auto mb-5 shadow-xl transition-transform hover:scale-105"
                        onClick={() => fileInputRef.current?.click()}
                        style={{
                            background: iconUrl ? `url(${iconUrl}) center/cover` : 'rgba(255,255,255,0.03)',
                            border: '1px solid rgba(255,255,255,0.1)'
                        }}>
                        {!iconUrl && (
                            <div className="absolute inset-0 flex items-center justify-center">
                                <span className="font-serif-brand" style={{ color: 'rgba(255,255,255,0.28)', fontSize: '1.5rem' }}>✦</span>
                            </div>
                        )}
                        <div className="absolute inset-0 bg-black/60 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center pointer-events-none">
                            {uploading ? (
                                <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                            ) : (
                                <span className="text-[9px] font-bold text-white uppercase tracking-wider">Upload</span>
                            )}
                        </div>
                    </div>
                    <input
                        type="file" ref={fileInputRef} className="hidden" accept="image/*"
                        onChange={async (e) => {
                            const file = e.target.files?.[0]
                            if (!file) return
                            setUploading(true)
                            const fd = new FormData(); fd.append('image', file)
                            try {
                                const res = await fetch('/api/channels/upload', {
                                    method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd
                                })
                                const data = JSON.parse(await res.text())
                                if (data.url) setIconUrl(data.url)
                            } catch (err) { setError('Upload failed') }
                            finally { setUploading(false); e.target.value = '' }
                        }}
                    />

                    <h2 className="font-serif-brand text-lg font-semibold mb-1" style={{ color: 'rgba(255,255,255,0.65)' }}>New space</h2>
                    <p className="text-sm" style={{ color: 'rgba(255,255,255,0.22)' }}>give your community a name & icon</p>
                </div>

                <form onSubmit={create} className="space-y-3">
                    <input
                        autoFocus value={name}
                        onChange={e => setName(e.target.value)}
                        placeholder="My Community"
                        required
                        className="pill-input w-full px-5 py-3 text-sm"
                    />
                    {error && (
                        <div className="text-sm px-4 py-2 rounded-full border"
                            style={{ color: 'rgba(255,100,100,0.75)', borderColor: 'rgba(255,100,100,0.15)', background: 'rgba(255,80,80,0.04)' }}>
                            {error}
                        </div>
                    )}
                    <div className="flex gap-2 pt-1">
                        <button type="button" onClick={onClose} className="pill-btn flex-1 py-3 text-sm">Cancel</button>
                        <button type="submit" disabled={loading || !name.trim()} className="pill-btn pill-btn-primary flex-1 py-3 text-sm">
                            {loading ? 'creating…' : 'Create →'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
