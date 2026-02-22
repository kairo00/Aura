import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export default function JoinServer() {
    const { code } = useParams();
    const { token, user, loading: authLoading } = useAuth();
    const navigate = useNavigate();
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!authLoading && !user) navigate(`/login?redirect=/join/${code}`);
    }, [user, authLoading, navigate, code]);

    const handleJoin = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API_URL}/api/servers/join/${code}`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await (async () => { const text = await res.text(); try { return JSON.parse(text) } catch (e) { throw e } })();
            if (res.ok) navigate('/');
            else setError(data.error || 'Invalid invite');
        } catch (e) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    if (authLoading || !user) return <div className="h-screen bg-black text-white/20 flex justify-center items-center text-xs">loading…</div>;

    return (
        <div className="h-screen bg-black flex flex-col justify-center items-center p-6" style={{ position: 'relative' }}>
            <div className="relative z-10 w-full max-w-xs text-center">
                <div className="w-12 h-12 rounded-full border border-white/10 flex items-center justify-center mx-auto mb-6">
                    <span className="font-serif-brand text-white/30 text-xl">✦</span>
                </div>

                <h1 className="font-serif-brand text-2xl font-semibold text-white/60 mb-2">You're invited</h1>
                <p className="text-white/25 text-xs mb-6 leading-relaxed">Accept this invitation to join the server.</p>

                <div className="pill-input text-[10px] text-white/25 font-mono px-5 py-2 mb-5 text-center mx-auto">
                    {code}
                </div>

                {error && <div className="text-red-400/70 text-xs px-5 py-2 border border-red-500/15 rounded-full mb-4">{error}</div>}

                <button onClick={handleJoin} disabled={loading}
                    className="pill-btn pill-btn-primary w-full py-3 text-sm mb-2 disabled:opacity-30">
                    {loading ? 'joining…' : 'Accept invitation →'}
                </button>

                <button onClick={() => navigate('/')}
                    className="text-white/20 hover:text-white/40 text-xs transition-colors">
                    Go back
                </button>
            </div>
        </div>
    );
}
