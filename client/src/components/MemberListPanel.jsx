import React, { useState, useEffect, useCallback } from 'react'
import { useSocket } from '../context/SocketContext'
import UserAvatar from './UserAvatar'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export default function MemberListPanel({ server, token, currentUser }) {
    const { onlineUsers } = useSocket()
    const [members, setMembers] = useState([])
    const [loading, setLoading] = useState(true)
    const [roles, setRoles] = useState([])

    const load = useCallback(async () => {
        if (!server?.id) return
        try {
            const [memRes, rolesRes] = await Promise.all([
                fetch(`${API_URL}/api/servers/${server.id}/members`, { headers: { Authorization: `Bearer ${token}` } }),
                fetch(`${API_URL}/api/servers/${server.id}/roles`, { headers: { Authorization: `Bearer ${token}` } })
            ])
            const mData = await memRes.json()
            const rData = await rolesRes.json()
            setMembers(Array.isArray(mData) ? mData : [])
            setRoles(Array.isArray(rData) ? rData : [])
        } catch (e) { console.error(e) }
        finally { setLoading(false) }
    }, [server?.id, token])

    useEffect(() => { setLoading(true); load() }, [load])

    // Calculate current user position for role hierarchy
    const currentUserMember = members.find(x => x.id === currentUser?.id);
    const currentUserPos = (() => {
        if (!currentUserMember) return -1;
        if (currentUserMember.id === server?.owner_id) return 1000;
        if (currentUserMember.role === 'Admin') return 500;
        return currentUserMember.role_position || 0;
    })();

    // Group members: first Admin, then by named role, then plain Members
    const grouped = (() => {
        const groups = {}
        const order = []

        for (const m of members) {
            let key, label, color
            if (m.role_name) {
                key = `role_${m.role_id}`; label = m.role_name; color = m.role_color
            } else if (m.role === 'Admin') {
                key = '__admin'; label = 'Admin'; color = '#f59e0b'
            } else {
                key = '__member'; label = 'Members'; color = null
            }
            if (!groups[key]) { groups[key] = { label, color, online: [], offline: [] }; order.push(key) }
            const isOnline = onlineUsers?.has(m.id)
            groups[key][isOnline ? 'online' : 'offline'].push(m)
        }
        return order.map(k => ({ key: k, ...groups[k] }))
    })()

    const total = members.length
    const onlineCount = members.filter(m => onlineUsers?.has(m.id)).length

    return (
        <div className="flex flex-col h-full overflow-hidden flex-shrink-0"
            style={{ width: '220px', borderLeft: '1px solid rgba(255,255,255,0.04)' }}>

            {/* Header */}
            <div className="px-4 pt-6 pb-4 flex-shrink-0">
                <div className="text-xs font-semibold uppercase tracking-widest mb-1"
                    style={{ color: 'rgba(255,255,255,0.18)' }}>Members</div>
                <div className="text-xs" style={{ color: 'rgba(255,255,255,0.18)' }}>
                    <span style={{ color: 'rgba(100,210,130,0.7)' }}>{onlineCount} online</span>
                    <span className="mx-1.5" style={{ color: 'rgba(255,255,255,0.1)' }}>·</span>
                    {total} total
                </div>
            </div>

            {/* Scrollable list */}
            <div className="flex-1 overflow-y-auto px-2 pb-4">
                {loading ? (
                    <div className="flex justify-center pt-8">
                        <div className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin"
                            style={{ borderColor: 'rgba(255,255,255,0.15)', borderTopColor: 'transparent' }} />
                    </div>
                ) : (
                    grouped.map(group => (
                        <div key={group.key} className="mb-5">
                            {/* Role label */}
                            <div className="flex items-center gap-1.5 px-2 mb-2">
                                {group.color && (
                                    <div className="w-2 h-2 rounded-full flex-shrink-0"
                                        style={{ background: group.color }} />
                                )}
                                <span className="text-[10px] font-semibold uppercase tracking-widest truncate"
                                    style={{ color: group.color || 'rgba(255,255,255,0.22)' }}>
                                    {group.label}
                                    <span className="ml-1.5 font-normal opacity-60">
                                        — {group.online.length + group.offline.length}
                                    </span>
                                </span>
                            </div>

                            {/* Online members */}
                            {group.online.map(m => (
                                <MemberRow key={m.id} member={m} isOnline={true}
                                    isSelf={m.id === currentUser?.id}
                                    server={server} token={token}
                                    currentUserPos={currentUserPos}
                                    roles={roles} onReload={load} />
                            ))}

                            {/* Offline members */}
                            {group.offline.map(m => (
                                <MemberRow key={m.id} member={m} isOnline={false}
                                    isSelf={m.id === currentUser?.id}
                                    server={server} token={token}
                                    currentUserPos={currentUserPos}
                                    roles={roles} onReload={load} />
                            ))}
                        </div>
                    ))
                )}
            </div>
        </div>
    )
}

function MemberRow({ member, isOnline, isSelf, server, token, currentUserPos, roles = [], onReload }) {
    const [menu, setMenu] = useState(false)
    const [busy, setBusy] = useState(false)

    const targetPos = (() => {
        if (!member) return -1;
        if (member.id === server?.owner_id) return 1000;
        if (member.role === 'Admin') return 500;
        return member.role_position || 0;
    })();

    const canModerate = currentUserPos >= 500;
    const canModifyThisUser = canModerate && !isSelf && currentUserPos > targetPos;

    const assignRole = async (e) => {
        const roleId = e.target.value
        setBusy(true)
        try {
            const res = await fetch(`${API_URL}/api/servers/${server.id}/members/${member.id}/role`, {
                method: 'PUT',
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ role_id: roleId ? parseInt(roleId) : null })
            })
            if (res.ok && onReload) await onReload()
            // Do not force close the menu. Keep it open so the user sees the confirmation that the 
            // dropdown value changed state successfully.
        } catch (err) { console.error(err) }
        finally { setBusy(false) }
    }

    const kick = async () => {
        if (busy || !confirm(`Kick ${member.username}?`)) return
        setBusy(true)
        try {
            await fetch(`${API_URL}/api/servers/${server.id}/bans/kick/${member.id}`, {
                method: 'POST', headers: { Authorization: `Bearer ${token}` }
            })
            setMenu(false)
        } catch (e) { console.error(e) }
        finally { setBusy(false) }
    }

    const ban = async () => {
        const reason = prompt(`Ban ${member.username}? Enter a reason (optional):`)
        if (reason === null) return // cancelled
        setBusy(true)
        try {
            await fetch(`${API_URL}/api/servers/${server.id}/bans/${member.id}`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ reason })
            })
            setMenu(false)
        } catch (e) { console.error(e) }
        finally { setBusy(false) }
    }

    return (
        <div className="relative group">
            <button
                onClick={() => canModifyThisUser && setMenu(p => !p)}
                className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-xl transition-colors duration-150"
                style={{ cursor: canModifyThisUser ? 'pointer' : 'default' }}
                onMouseEnter={e => { if (canModifyThisUser) e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>

                <div className="relative flex-shrink-0">
                    <UserAvatar user={member} size={7} />
                    {/* Online dot */}
                    <div className="absolute -bottom-px -right-px w-2 h-2 rounded-full border border-black"
                        style={{ background: isOnline ? '#34d399' : 'rgba(255,255,255,0.12)' }} />
                </div>

                <div className="flex-1 min-w-0 text-left">
                    <div className="text-xs font-medium truncate"
                        style={{ color: isOnline ? 'rgba(255,255,255,0.72)' : 'rgba(255,255,255,0.3)' }}>
                        {member.username}
                        {isSelf && <span className="ml-1 text-[10px]" style={{ color: 'rgba(255,255,255,0.28)' }}>(you)</span>}
                    </div>
                    {member.role_name && (
                        <div className="text-[10px] truncate" style={{ color: member.role_color || 'rgba(255,255,255,0.22)' }}>
                            {member.role_name}
                        </div>
                    )}
                    {member.role === 'Admin' && !member.role_name && (
                        <div className="text-[10px]" style={{ color: '#f59e0b88' }}>Admin</div>
                    )}
                </div>
            </button>

            {/* Moderator dropdown */}
            {menu && canModifyThisUser && (
                <div className="absolute right-0 top-full z-50 mt-1 rounded-xl overflow-hidden shadow-2xl py-1 pb-1 flex flex-col"
                    style={{ background: 'rgba(20,20,30,0.98)', border: '1px solid rgba(255,255,255,0.08)', minWidth: '150px' }}
                    onMouseLeave={() => setMenu(false)}>

                    {roles.length > 0 && (
                        <div className="px-3 py-2 border-b" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                            <div className="text-[10px] font-semibold uppercase tracking-widest mb-1.5" style={{ color: 'rgba(255,255,255,0.3)' }}>Role</div>
                            <select value={member.role_id || ''} onChange={assignRole} disabled={busy}
                                className="w-full bg-transparent text-xs outline-none cursor-pointer"
                                style={{ color: 'rgba(255,255,255,0.85)' }}>
                                <option value="" style={{ background: '#111' }}>Member (Default)</option>
                                {roles.filter(r => r.position < currentUserPos).map(r => (
                                    <option key={r.id} value={r.id} style={{ background: '#111' }}>{r.name}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    <button onClick={kick} disabled={busy}
                        className="w-full flex items-center gap-2 px-3 py-2.5 text-xs font-medium transition-colors text-left"
                        style={{ color: 'rgba(255,200,100,0.85)' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,200,100,0.08)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                        👢 Kick
                    </button>
                    <button onClick={ban} disabled={busy}
                        className="w-full flex items-center gap-2 px-3 py-2.5 text-xs font-medium transition-colors text-left"
                        style={{ color: 'rgba(255,100,100,0.85)' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,100,100,0.08)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                        🔨 Ban
                    </button>
                </div>
            )}
        </div>
    )
}
