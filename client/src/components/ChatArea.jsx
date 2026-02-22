import React, { useState, useEffect, useRef } from 'react'
import MessageList from './MessageList'
import MessageInput from './MessageInput'

export default function ChatArea({ channel, server, token, socket, user }) {
    const [messages, setMessages] = useState([])
    const [typing, setTyping] = useState([])
    const [hasMore, setHasMore] = useState(true)
    const [loadingMore, setLoadingMore] = useState(false)
    const typingTimers = useRef({})
    const prevChannelId = useRef(null)

    useEffect(() => {
        if (!channel) return
        if (prevChannelId.current && socket) socket.emit('leave_channel', { channelId: prevChannelId.current })
        prevChannelId.current = channel.id

        fetch(`/api/channels/${channel.id}/messages`, { headers: { Authorization: `Bearer ${token}` } })
            .then(r => r.json()).then(data => {
                const arr = Array.isArray(data) ? data : []
                setMessages(arr.reverse())
                setHasMore(arr.length >= 50)
            }).catch(console.error)

        if (socket) socket.emit('join_channel', { channelId: channel.id })
        setTyping([])
    }, [channel?.id])

    useEffect(() => {
        if (!socket) return

        const onMsg = (msg) => {
            if (msg.channel_id !== channel?.id) return
            setMessages(prev => [...prev, { ...msg, reactions: [] }])
            setTyping(prev => prev.filter(u => u !== msg.username))
        }

        const onDeleted = ({ messageId }) => {
            setMessages(prev => prev.filter(m => m.id !== messageId))
        }

        // Fix: coerce messageId to number for reliable comparison
        const onReactionUpdate = ({ messageId, emoji, userId, action }) => {
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

        const onTyping = ({ username, channelId }) => {
            if (channelId !== channel?.id || username === user.username) return
            setTyping(prev => prev.includes(username) ? prev : [...prev, username])
            clearTimeout(typingTimers.current[username])
            typingTimers.current[username] = setTimeout(() => setTyping(prev => prev.filter(u => u !== username)), 3000)
        }
        const onStop = ({ username }) => {
            clearTimeout(typingTimers.current[username])
            setTyping(prev => prev.filter(u => u !== username))
        }

        socket.on('new_message', onMsg)
        socket.on('message_deleted', onDeleted)
        socket.on('user_typing', onTyping)
        socket.on('user_stop_typing', onStop)
        socket.on('reaction_updated', onReactionUpdate)
        return () => {
            socket.off('new_message', onMsg)
            socket.off('message_deleted', onDeleted)
            socket.off('user_typing', onTyping)
            socket.off('user_stop_typing', onStop)
            socket.off('reaction_updated', onReactionUpdate)
        }
    }, [socket, channel?.id, user.username])

    const sendMessage = (content, attachmentUrl) => {
        if (!socket || (!content?.trim() && !attachmentUrl)) return
        socket.emit('send_message', { channelId: channel.id, content, attachmentUrl })
    }

    const loadMore = async () => {
        if (!hasMore || !messages.length || loadingMore) return
        setLoadingMore(true)
        try {
            const beforeId = messages[0].id
            const res = await fetch(`/api/channels/${channel.id}/messages?before=${beforeId}`, { headers: { Authorization: `Bearer ${token}` } })
            const older = await res.json()
            if (older.length < 50) setHasMore(false)
            setMessages(prev => [...older.reverse(), ...prev])
        } catch (e) { console.error(e) }
        finally { setLoadingMore(false) }
    }

    return (
        <div className="flex flex-col h-full overflow-hidden">
            {/* Floating channel label — no header bar */}
            <div className="flex items-center gap-3 px-10 pt-8 pb-4 flex-shrink-0">
                <span className="text-lg" style={{ color: 'rgba(255,255,255,0.16)' }}>#</span>
                <span className="font-serif-brand text-lg font-medium" style={{ color: 'rgba(255,255,255,0.52)' }}>
                    {channel.name}
                </span>
                {server?.name && (
                    <span className="text-sm" style={{ color: 'rgba(255,255,255,0.2)' }}>
                        &mdash; {server.name}
                    </span>
                )}
                {typing.length > 0 && (
                    <span className="ml-auto flex items-center gap-2 text-sm" style={{ color: 'rgba(255,255,255,0.25)' }}>
                        <span className="inline-flex gap-0.5 items-center">
                            {[0, 1, 2].map(i => (
                                <span key={i} className="inline-block w-1.5 h-1.5 rounded-full"
                                    style={{ background: 'rgba(255,255,255,0.38)', animation: `pulse-dot 1.2s ease-in-out ${i * 0.22}s infinite` }} />
                            ))}
                        </span>
                        {typing.join(', ')} typing…
                    </span>
                )}
            </div>

            <MessageList messages={messages} user={user} token={token}
                hasMore={hasMore} onLoadMore={loadMore} loadingMore={loadingMore}
                userRole={server?.role}
                onDeleteMessage={(id) => setMessages(prev => prev.filter(m => m.id !== id))} />

            <MessageInput
                placeholder={`Message #${channel.name}`}
                onSend={sendMessage}
                onTyping={(isTyping) => socket?.emit(isTyping ? 'typing_start' : 'typing_stop', { channelId: channel.id })}
                token={token}
                user={user}
            />
        </div>
    )
}
