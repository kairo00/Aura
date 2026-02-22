import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import Login from './pages/Login'
import Register from './pages/Register'
import MainApp from './pages/MainApp'
import JoinServer from './pages/JoinServer'
import AdminDashboard from './pages/AdminDashboard'

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="flex items-center justify-center h-screen bg-slate-950 text-slate-400">Chargement…</div>
  if (!user) return <Navigate to="/login" replace />
  return children
}

export default function App() {
  return (
    <BrowserRouter>
      {/* ── Global Cinematic Grid ── */}
      <div aria-hidden="true" style={{
        position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none',
        backgroundImage: [
          'linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px)',
          'linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px)'
        ].join(','),
        backgroundSize: '80px 80px',
        WebkitMaskImage: 'radial-gradient(ellipse 65% 85% at 50% 50%, black 10%, rgba(0,0,0,0.4) 50%, transparent 80%)',
        maskImage: 'radial-gradient(ellipse 65% 85% at 50% 50%, black 10%, rgba(0,0,0,0.4) 50%, transparent 80%)',
      }} />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/join/:code" element={<JoinServer />} />
        <Route path="/admin" element={<ProtectedRoute><AdminDashboard /></ProtectedRoute>} />
        <Route path="/*" element={<ProtectedRoute><MainApp /></ProtectedRoute>} />
      </Routes>
    </BrowserRouter>
  )
}
