export const AUTH_PROBE_PATH = import.meta.env.VITE_AUTH_PATH || '/cgi-bin/magicBox.cgi?action=getLanguageCaps'
export const AUTH_METHOD = (import.meta.env.VITE_AUTH_METHOD || 'GET').toUpperCase()
export const AUTH_FALLBACK_PATH = import.meta.env.VITE_AUTH_FALLBACK_PATH || '/cgi-bin/api/global/login'
export const AUTH_FALLBACK_METHOD = (import.meta.env.VITE_AUTH_FALLBACK_METHOD || 'POST').toUpperCase()

export function getRequestUri(url) {
    try {
        const parsedUrl = new URL(url, window.location.origin)
        return `${parsedUrl.pathname}${parsedUrl.search}`
    } catch {
        return String(url || '/')
    }
}
