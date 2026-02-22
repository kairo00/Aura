import React, { useState, useEffect } from 'react'
import Tip from './Tip'
import { extractDominantColor } from '../utils/dominantColor'

const PALETTE = ['#6366f1', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#3b82f6']
function paletteColor(name) {
    if (!name) return PALETTE[0]
    let h = 0; for (const c of name) h = (h * 31 + c.charCodeAt(0)) & 0xffffffff
    return PALETTE[Math.abs(h) % PALETTE.length]
}

// Single server button with adaptive glow
function ServerButton({ server, isActive, onClick, onMouseEnter, onMouseLeave }) {
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
    const [glow, setGlow] = useState(() => paletteColor(server.name))

    useEffect(() => {
        if (server.icon) {
            extractDominantColor(server.icon, paletteColor(server.name)).then(setGlow)
        } else {
            setGlow(paletteColor(server.name))
        }
    }, [server.icon, server.name])

    // Task 3: white/solid ring ONLY when server has an uploaded image
    const hasImage = Boolean(server.icon)

    const activeStyle = hasImage
        ? {
            // Image server: white border ring over the image
            border: '2px solid rgba(255,255,255,0.88)',
            boxShadow: `0 0 20px ${glow}60`
        }
        : {
            // No-image server: retain palette-colored glow default focus
            border: `2px solid ${glow}`,
            boxShadow: `0 0 16px ${glow}80`,
            background: `${glow}2a`,
            color: glow
        }

    const inactiveStyle = hasImage
        ? { border: '1px solid rgba(255,255,255,0.1)' }
        : { border: '1px solid rgba(255,255,255,0.1)', color: `${glow}bb` }

    return (
        // Task 1: CSS variable set on wrapper, transitions applied via CSS
        <div style={{ '--glow-color': glow, transition: 'all 0.3s ease' }}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}>
            <button
                onClick={onClick}
                className={`rail-icon flex-shrink-0 text-xs font-semibold tracking-wide ${isActive ? 'active' : ''}`}
                style={{
                    transition: 'box-shadow 0.35s ease, border-color 0.35s ease, background 0.35s ease',
                    ...(server.icon ? { background: `url('${server.icon.startsWith('http') ? server.icon : `${API_URL}${server.icon}`}') center/cover`, color: 'transparent' } : {}),
                    ...(isActive ? activeStyle : inactiveStyle)
                }}
            >
                {!server.icon && server.name.slice(0, 2).toUpperCase()}
            </button>
        </div>
    )
}

export default function ServerRail({ servers, selectedServer, onSelectServer, onSelectHome, onCreateServer, view }) {
    return (
        <>
            <Tip label="Direct Messages">
                <button
                    onClick={onSelectHome}
                    className={`rail-icon flex-shrink-0 ${view === 'home' ? 'active' : ''}`}
                >
                    <span className="font-serif-brand text-xl">✦</span>
                </button>
            </Tip>

            <div className="w-6 h-px flex-shrink-0 my-1.5" style={{ background: 'rgba(255,255,255,0.06)' }} />

            {servers.map(server => (
                <Tip key={server.id} label={server.name}>
                    <ServerButton
                        server={server}
                        isActive={selectedServer?.id === server.id}
                        onClick={() => onSelectServer(server)}
                    />
                </Tip>
            ))}

            {servers.length > 0 && (
                <div className="w-6 h-px flex-shrink-0 my-1.5" style={{ background: 'rgba(255,255,255,0.06)' }} />
            )}

            <Tip label="New space">
                <button
                    onClick={onCreateServer}
                    className="rail-icon flex-shrink-0 text-2xl font-light"
                    style={{ borderStyle: 'dashed', borderColor: 'rgba(255,255,255,0.08)' }}
                >
                    +
                </button>
            </Tip>
        </>
    )
}
