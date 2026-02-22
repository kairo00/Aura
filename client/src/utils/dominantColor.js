/**
 * Extracts the dominant color from an image URL using an off-screen <canvas>.
 * Returns a CSS rgb() string, e.g. "rgb(110, 80, 240)".
 * Falls back to the provided fallback color if the image fails to load.
 *
 * @param {string} src           - Image URL
 * @param {string} fallback      - CSS color string to return on error
 * @returns {Promise<string>}
 */
export function extractDominantColor(src, fallback = '#6366f1') {
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
    return new Promise((resolve) => {
        if (!src) return resolve(fallback)

        const img = new Image()
        img.crossOrigin = 'anonymous'

        img.onload = () => {
            try {
                const canvas = document.createElement('canvas')
                // Sample a tiny thumbnail for speed — 1x1 fast, 8x8 more accurate
                const SIZE = 8
                canvas.width = SIZE
                canvas.height = SIZE
                const ctx = canvas.getContext('2d')
                ctx.drawImage(img, 0, 0, SIZE, SIZE)
                const data = ctx.getImageData(0, 0, SIZE, SIZE).data

                let r = 0, g = 0, b = 0, count = 0
                for (let i = 0; i < data.length; i += 4) {
                    const alpha = data[i + 3]
                    if (alpha < 128) continue // skip transparent pixels
                    r += data[i]
                    g += data[i + 1]
                    b += data[i + 2]
                    count++
                }
                if (count === 0) return resolve(fallback)
                r = Math.round(r / count)
                g = Math.round(g / count)
                b = Math.round(b / count)

                // Boost saturation: pull the dominant channel up, suppress the rest slightly
                const max = Math.max(r, g, b)
                const BOOST = 1.35
                r = Math.min(255, max === r ? Math.round(r * BOOST) : Math.round(r * 0.75))
                g = Math.min(255, max === g ? Math.round(g * BOOST) : Math.round(g * 0.75))
                b = Math.min(255, max === b ? Math.round(b * BOOST) : Math.round(b * 0.75))

                const toHex = c => c.toString(16).padStart(2, '0')
                resolve(`#${toHex(r)}${toHex(g)}${toHex(b)}`)
            } catch {
                resolve(fallback)
            }
        }
        img.onerror = () => resolve(fallback)
        img.src = src.startsWith('http') ? src : `${API_URL}${src}`
    })
}
