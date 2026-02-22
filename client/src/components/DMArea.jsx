import React, { useState, useEffect, useRef } from 'react'
import MessageList from './MessageList'
import MessageInput from './MessageInput'
import UserAvatar from './UserAvatar'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

function getColor(name) {
    const C = ['#6366f1', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#3b82f6']
    if (!name) return C[0]
    let h = 0; for (let c of name) h = (h * 31 + c.charCodeAt(0)) & 0xffffffff
    return C[Math.abs(h) % C.length]
}

export default function DMArea({ thread, token, socket, user }) {
    const [messages, setMessages] = useState([])
    const [typing, setTyping] = useState(false)
    const typingTimer = useRef(null)
    const prevThreadId = useRef(null)

    useEffect(() => {
        if (!thread) return
        if (prevThreadId.current && socket) socket.emit('leave_dm', { threadId: prevThreadId.current })
        prevThreadId.current = thread.threadId

        fetch(`${API_URL}/api/dm/${thread.threadId}/messages`, { headers: { Authorization: `Bearer ${token}` } })
            .then(r => r.json()).then(data => setMessages(Array.isArray(data) ? data : []))
            .catch(console.error)

        if (socket) socket.emit('join_dm', { threadId: thread.threadId })
        setTyping(false)
    }, [thread?.threadId])

    useEffect(() => {
        if (!socket) return

        const onMsg = (msg) => {
            if (msg.thread_id !== thread?.threadId) return
            setMessages(prev => [...prev, { ...msg, reactions: [] }])
            setTyping(false)
        }

        // DM-specific reaction event — emitted to dm:${threadId} room
        const onDmReaction = ({ messageId, emoji, userId, action }) => {
            const mid = Number(messageId)
            setMessages(prev => prev.map(m => {
                if (m.id !== mid) return m
                let r = [...(m.reactions || [])]
                if (action === 'add') {
                    if (!r.find(x => x.emoji === emoji && x.user_id === userId)) r.push({ emoji, user_id: userId })
                } else {
                    r = r.filter(x => !(x.emoji === emoji && x.user_id === userId))
                }
                return { ...m, reactions: r }
            }))
        }

        const onTyping = ({ username, threadId }) => {
            if (threadId !== thread?.threadId || username === user.username) return
            setTyping(true)
            clearTimeout(typingTimer.current)
            typingTimer.current = setTimeout(() => setTyping(false), 3000)
        }
        const onStop = ({ threadId }) => {
            if (threadId !== thread?.threadId) return
            clearTimeout(typingTimer.current); setTyping(false)
        }

        socket.on('new_dm', onMsg)
        socket.on('dm_reaction_updated', onDmReaction)
        socket.on('dm_user_typing', onTyping)
        socket.on('dm_user_stop_typing', onStop)
        return () => {
            socket.off('new_dm', onMsg)
            socket.off('dm_reaction_updated', onDmReaction)
            socket.off('dm_user_typing', onTyping)
            socket.off('dm_user_stop_typing', onStop)
        }
    }, [socket, thread?.threadId, user.username])

    const sendDM = (content, attachmentUrl) => {
        if (!socket || (!content?.trim() && !attachmentUrl)) return
        socket.emit('send_dm', { threadId: thread.threadId, content, attachmentUrl })
    }

    const partner = thread.partner
    return (
        <div className="flex flex-col h-full overflow-hidden">
            {/* Floating DM header */}
            <div className="flex items-center gap-4 px-10 pt-8 pb-4 flex-shrink-0">
                <UserAvatar user={partner} size={10} className="flex-shrink-0" />
                <span className="font-serif-brand text-xl font-medium" style={{ color: 'rgba(255,255,255,0.55)' }}>
                    {partner?.username}
                </span>
                {typing && (
                    <span className="ml-auto flex items-center gap-2 text-sm" style={{ color: 'rgba(255,255,255,0.25)' }}>
                        <span className="inline-flex gap-0.5">
                            {[0, 1, 2].map(i => (
                                <span key={i} className="inline-block w-1.5 h-1.5 rounded-full"
                                    style={{ background: 'rgba(255,255,255,0.38)', animation: `pulse-dot 1.2s ease-in-out ${i * 0.22}s infinite` }} />
                            ))}
                        </span>
                        typing…
                    </span>
                )}
            </div>

            {/* Pass isDM so MessageList uses /api/dm/ reaction endpoints */}
            <MessageList messages={messages} user={user} token={token} isDM={true} />

            <MessageInput
                placeholder={`Message @${partner?.username}`}
                onSend={sendDM}
                onTyping={(t) => socket?.emit(t ? 'dm_typing_start' : 'dm_typing_stop', { threadId: thread.threadId })}
                token={token}
            />
        </div>
    )
}
