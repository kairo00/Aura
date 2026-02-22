import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Register() {
    const { register } = useAuth()
    const navigate = useNavigate()
    const [form, setForm] = useState({ username: '', password: '', confirm: '' })
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)

    const submit = async (e) => {
        e.preventDefault()
        setError('')
        if (form.password !== form.confirm) return setError('Passwords do not match')
        setLoading(true)
        try {
            await register(form.username, form.password)
            navigate('/')
        } catch (err) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen bg-black flex items-center justify-center p-6" style={{ position: 'relative' }}>
            <div className="relative z-10 w-full max-w-xs">
                <div className="text-center mb-10">
                    <div className="w-12 h-12 rounded-full border border-white/10 flex items-center justify-center mx-auto mb-5">
                        <span className="font-serif-brand text-white/40 text-xl">✦</span>
                    </div>
                    <h1 className="font-serif-brand text-2xl font-semibold text-white/70 tracking-wide">Create account</h1>
                    <p className="text-white/25 text-xs mt-1.5 tracking-wide">join the conversation</p>
                </div>

                <form onSubmit={submit} className="space-y-3">
                    <input
                        type="text" required autoFocus minLength={2}
                        value={form.username}
                        onChange={e => setForm(p => ({ ...p, username: e.target.value }))}
                        className="pill-input w-full px-5 py-3 text-sm"
                        placeholder="username"
                    />
                    <input
                        type="password" required minLength={4}
                        value={form.password}
                        onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                        className="pill-input w-full px-5 py-3 text-sm"
                        placeholder="password"
                    />
                    <input
                        type="password" required
                        value={form.confirm}
                        onChange={e => setForm(p => ({ ...p, confirm: e.target.value }))}
                        className="pill-input w-full px-5 py-3 text-sm"
                        placeholder="confirm password"
                    />

                    {error && (
                        <div className="text-red-400/70 text-xs px-5 py-2 border border-red-500/15 rounded-full bg-red-500/5">
                            {error}
                        </div>
                    )}

                    <button
                        type="submit" disabled={loading}
                        className="pill-btn pill-btn-primary w-full py-3 text-sm disabled:opacity-40 mt-1"
                    >
                        {loading ? 'creating…' : 'Create account →'}
                    </button>
                </form>

                <p className="text-center text-white/20 text-xs mt-7">
                    Already have one?{' '}
                    <Link to="/login" className="text-purple-400/60 hover:text-purple-300 transition-colors">
                        Sign in
                    </Link>
                </p>
            </div>
        </div>
    )
}
