import React, { useState, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'

/**
 * Tooltip that renders as a fixed portal — never clipped by overflow:hidden parents.
 * Usage: <Tip label="My tooltip"><button>…</button></Tip>
 */
export default function Tip({ label, children, side = 'right' }) {
    const [pos, setPos] = useState(null)
    const timeoutRef = useRef(null)

    const show = useCallback((e) => {
        const rect = e.currentTarget.getBoundingClientRect()
        timeoutRef.current = setTimeout(() => {
            setPos({
                top: rect.top + rect.height / 2,
                left: side === 'right' ? rect.right + 10 : rect.left - 10,
            })
        }, 320)
    }, [side])

    const hide = useCallback(() => {
        clearTimeout(timeoutRef.current)
        setPos(null)
    }, [])

    return (
        <>
            {React.cloneElement(children, { onMouseEnter: show, onMouseLeave: hide })}
            {pos && createPortal(
                <div
                    className="tip-bubble"
                    style={{
                        top: pos.top,
                        left: pos.left,
                        transform: side === 'right' ? 'translateY(-50%)' : 'translateX(-100%) translateY(-50%)',
                        opacity: pos ? 1 : 0,
                    }}>
                    {label}
                </div>,
                document.body
            )}
        </>
    )
}
