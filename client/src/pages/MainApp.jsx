import React, { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { useSocket } from '../context/SocketContext'
import { extractDominantColor } from '../utils/dominantColor'
import UserAvatar from '../components/UserAvatar'
import ServerRail from '../components/ServerRail'
import Sidebar from '../components/Sidebar'
import ChatArea from '../components/ChatArea'
import DMList from '../components/DMList'
import DMArea from '../components/DMArea'
import SettingsModal from '../components/SettingsModal'
import CreateServerModal from '../components/CreateServerModal'
import MemberListPanel from '../components/MemberListPanel'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export default function MainApp() {
    const { user, token } = useAuth()
    const { socket } = useSocket()

    const [servers, setServers] = useState([])
    const [selectedServer, setSelectedServer] = useState(null)
    const [selectedChannel, setSelectedChannel] = useState(null)
    const [selectedDM, setSelectedDM] = useState(null)
    const [view, setView] = useState(() => sessionStorage.getItem('app_view') || 'home')
    const [showSettings, setShowSettings] = useState(false)
    const [showCreateServer, setShowCreateServer] = useState(false)
    const [unread, setUnread] = useState({})
    const [userGlow, setUserGlow] = useState(user.avatar_color)

    useEffect(() => {
        if (user.avatar_url) {
            extractDominantColor(user.avatar_url, user.avatar_color).then(setUserGlow)
        } else {
            setUserGlow(user.avatar_color)
        }
    }, [user.avatar_url, user.avatar_color])

    // IDs restored from session — use to re-hydrate after loadServers
    const [pendingServerId] = useState(() => {
        const v = sessionStorage.getItem('app_view')
        return v === 'server' ? sessionStorage.getItem('selected_server_id') : null
    })
    const [pendingChannelId] = useState(() => sessionStorage.getItem('selected_channel_id'))

    const authHeader = { Authorization: `Bearer ${token}` }

    const loadServers = async () => {
        try {
            const res = await fetch(`${API_URL}/api/servers`, { headers: authHeader })
            const txt = await res.text()
            const data = JSON.parse(txt)
            setServers(data)
        } catch (e) { console.error(e) }
    }

    useEffect(() => {
        loadServers()
    }, [])

    // Restore navigation after servers load
    useEffect(() => {
        if (!servers.length) return
        if (pendingServerId) {
            const srv = servers.find(s => String(s.id) === pendingServerId)
            if (srv) {
                setSelectedServer(srv)
                setView('server')
                // Channel will be hydrated by Sidebar once channels load
            }
        }
    }, [servers])

    useEffect(() => {
        if (!socket) return
        const onMsg = (msg) => {
            if (selectedChannel?.id === msg.channel_id) return
            setUnread(prev => ({ ...prev, [msg.channel_id]: (prev[msg.channel_id] || 0) + 1 }))
        }
        const onDM = (msg) => {
            if (selectedDM?.threadId === msg.thread_id) return
            setUnread(prev => ({ ...prev, [`dm_${msg.thread_id}`]: (prev[`dm_${msg.thread_id}`] || 0) + 1 }))
        }
        const onServerCreated = (server) => setServers(prev =>
            prev.find(s => s.id === server.id) ? prev : [...prev, server]
        )
        const onServerJoined = (server) => setServers(prev =>
            prev.find(s => s.id === server.id) ? prev : [...prev, server]
        )
        socket.on('new_message', onMsg)
        socket.on('new_dm', onDM)
        socket.on('server_created', onServerCreated)
        socket.on('server_joined', onServerJoined)
        return () => {
            socket.off('new_message', onMsg)
            socket.off('new_dm', onDM)
            socket.off('server_created', onServerCreated)
            socket.off('server_joined', onServerJoined)
        }
    }, [socket, selectedChannel, selectedDM])

    const selectServer = (server) => {
        setSelectedServer(server)
        setSelectedDM(null)
        setSelectedChannel(null) // Clear channel so Sidebar auto-picks first
        setView('server')
        sessionStorage.setItem('app_view', 'server')
        sessionStorage.setItem('selected_server_id', String(server.id))
        sessionStorage.removeItem('selected_channel_id')
    }
    const selectChannel = (channel) => {
        setSelectedChannel(channel)
        sessionStorage.setItem('selected_channel_id', String(channel.id))
        setUnread(prev => { const n = { ...prev }; delete n[channel.id]; return n })
    }
    const selectDM = (thread) => {
        setSelectedDM(thread); setSelectedServer(null); setSelectedChannel(null); setView('home')
        sessionStorage.setItem('app_view', 'home')
        sessionStorage.removeItem('selected_server_id')
        sessionStorage.removeItem('selected_channel_id')
        setUnread(prev => { const n = { ...prev }; delete n[`dm_${thread.threadId}`]; return n })
    }

    const handleCreateServer = async (name) => {
        const res = await fetch(`${API_URL}/api/servers`, {
            method: 'POST',
            headers: { ...authHeader, 'Content-Type': 'application/json' },
            body: JSON.stringify({ name })
        })
        const txt = await res.text()
        const data = JSON.parse(txt)
        if (!res.ok) throw new Error(data.error || 'Failed')
        setShowCreateServer(false)
        // server_created socket event handles adding to list
    }

    return (
        <div className="flex h-screen overflow-hidden" style={{ position: 'relative', background: 'transparent' }}>
            {/* ── Left column: floating rail + sidebar panel ── */}
            <div className="flex gap-3 p-4 flex-shrink-0">
                {/* Rail: bare icons, no panel background */}
                <div className="flex flex-col items-center py-5 gap-2 w-14 overflow-y-auto flex-shrink-0" style={{ zIndex: 1 }}>
                    <ServerRail
                        servers={servers}
                        selectedServer={selectedServer}
                        onSelectServer={selectServer}
                        onSelectHome={() => { setView('home'); setSelectedServer(null); setSelectedChannel(null) }}
                        onCreateServer={() => setShowCreateServer(true)}
                        view={view}
                    />
                </div>

                {/* Sidebar: glass panel */}
                <div className="panel w-60 flex flex-col overflow-hidden">
                    {view === 'server' && selectedServer ? (
                        <Sidebar
                            server={selectedServer}
                            selectedChannel={selectedChannel}
                            onSelectChannel={selectChannel}
                            unread={unread}
                            token={token}
                            socket={socket}
                            pendingChannelId={pendingChannelId}
                            onServerUpdated={(srv) => {
                                if (!srv) { // server deleted
                                    setSelectedServer(null)
                                    setSelectedChannel(null)
                                    setView('home')
                                    sessionStorage.removeItem('app_view')
                                    sessionStorage.removeItem('selected_server_id')
                                    sessionStorage.removeItem('selected_channel_id')
                                    loadServers()
                                } else {
                                    setSelectedServer(srv)
                                    setServers(prev => prev.map(s => s.id === srv.id ? srv : s))
                                }
                            }}
                        />
                    ) : (
                        <DMList selectedDM={selectedDM} onSelectDM={selectDM} unread={unread} token={token} />
                    )}

                    {/* User strip at bottom of sidebar */}
                    <div className="flex items-center gap-3 px-5 py-4 flex-shrink-0"
                        style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                        <button onClick={() => setShowSettings(true)} className="relative flex-shrink-0 group" data-tip="Settings">
                            <UserAvatar user={user} size={9}
                                className="transition-transform duration-200 group-hover:scale-105"
                                style={{ boxShadow: `0 0 14px ${userGlow}88` }}
                            />
                            <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-400 rounded-full border-2 border-black" />
                        </button>
                        <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate" style={{ color: 'rgba(255,255,255,0.7)' }}>{user.username}</div>
                            <div className="text-xs" style={{ color: 'rgba(100,220,130,0.7)' }}>online</div>
                        </div>
                        <button onClick={() => setShowSettings(true)} data-tip="Settings"
                            className="p-1.5 rounded-full transition-all duration-200"
                            style={{ color: 'rgba(255,255,255,0.2)' }}
                            onMouseEnter={e => e.currentTarget.style.color = 'rgba(255,255,255,0.6)'}
                            onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.2)'}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="12" cy="12" r="3" />
                                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06-.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                            </svg>
                        </button>
                    </div>
                </div>
            </div>

            {/* ── Main chat area ── */}
            <div className="flex flex-1 overflow-hidden" style={{ zIndex: 1, paddingTop: '1rem', paddingBottom: '1rem' }}>
                <div className="flex-1 flex flex-col overflow-hidden" style={{ paddingRight: view === 'server' && selectedChannel ? '0' : '1rem' }}>
                    {view === 'server' && selectedChannel ? (
                        <ChatArea channel={selectedChannel} server={selectedServer} token={token} socket={socket} user={user} />
                    ) : view === 'home' && selectedDM ? (
                        <DMArea thread={selectedDM} token={token} socket={socket} user={user} />
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-center">
                            <div className="w-16 h-16 rounded-full border mb-8 flex items-center justify-center"
                                style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                                <span className="font-serif-brand text-2xl" style={{ color: 'rgba(255,255,255,0.12)' }}>✦</span>
                            </div>
                            <h2 className="font-serif-brand text-3xl font-medium mb-3" style={{ color: 'rgba(255,255,255,0.28)' }}>
                                {view === 'server' ? 'Pick a channel' : 'Welcome'}
                            </h2>
                            <p className="text-base max-w-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.15)' }}>
                                {view === 'server' ? 'Select a channel to begin.' : 'Choose a conversation or join a server.'}
                            </p>
                        </div>
                    )}
                </div>

                {/* Members panel — only in server channel views */}
                {view === 'server' && selectedChannel && (
                    <MemberListPanel server={selectedServer} token={token} currentUser={user} />
                )}
            </div>

            {showSettings && <SettingsModal onClose={() => setShowSettings(false)} token={token} />}
            {showCreateServer && (
                <CreateServerModal onClose={() => setShowCreateServer(false)} onCreate={handleCreateServer} />
            )}
        </div>
    )
}
