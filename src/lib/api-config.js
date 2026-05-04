export const AUTH_PROBE_PATH = '/cgi-bin/magicBox.cgi?action=getLanguageCaps'
export const AUTH_METHOD =  'GET'

const digestPathPrefixes = String(import.meta.env.VITE_DIGEST_PATH_PREFIXES || '/cgi-bin/')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean)

export function getRequestUri(url) {
    try {
        const parsedUrl = new URL(url, window.location.origin)
        return `${parsedUrl.pathname}${parsedUrl.search}`
    } catch {
        return String(url || '/')
    }
}

export function shouldUseDigestForUrl(url) {
    const requestUri = getRequestUri(url || '/')
    const pathOnly = String(requestUri).split('?')[0].toLowerCase()
    return digestPathPrefixes.some((prefix) => pathOnly.startsWith(prefix))
}
