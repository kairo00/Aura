import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(() => localStorage.getItem('token'));
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (token) {
            const stored = localStorage.getItem('user');
            if (stored) {
                setUser(JSON.parse(stored));
            }
        }
        setLoading(false);
    }, []);

    const login = async (username, password) => {
        const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await (async () => { const text = await res.text(); try { return JSON.parse(text); } catch(e) { console.error('JSON Error:', res.status, text.substring(0, 200)); throw e; } })();
        if (!res.ok) throw new Error(data.error);
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        setToken(data.token);
        setUser(data.user);
        return data;
    };

    const register = async (username, password) => {
        const res = await fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await (async () => { const text = await res.text(); try { return JSON.parse(text); } catch(e) { console.error('JSON Error:', res.status, text.substring(0, 200)); throw e; } })();
        if (!res.ok) throw new Error(data.error);
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        setToken(data.token);
        setUser(data.user);
        return data;
    };

    const logout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setToken(null);
        setUser(null);
    };

    const updateUser = (updated) => {
        const merged = { ...user, ...updated };
        localStorage.setItem('user', JSON.stringify(merged));
        setUser(merged);
    };

    return (
        <AuthContext.Provider value={{ user, token, loading, login, register, logout, updateUser }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => useContext(AuthContext);
