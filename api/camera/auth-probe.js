const CAMERA_TARGET = process.env.CAMERA_TARGET || 'http://103.194.172.70:8080'

function getCameraBaseOrigin() {
    try {
        const parsed = new URL(CAMERA_TARGET)
        return `${parsed.protocol}//${parsed.host}/`
    } catch {
        return 'http://103.194.172.70:8080/'
    }
}

function sanitizeRequestHeaders(headers) {
    const source = headers || {}
    const nextHeaders = {}

    const allowList = [
        'authorization',
        'content-type',
        'accept',
        'cache-control',
        'pragma',
        'user-agent',
        'x-requested-with',
    ]

    allowList.forEach((key) => {
        const value = source[key] ?? source[key.toLowerCase()] ?? source[key.toUpperCase()]
        if (value !== undefined && value !== null && value !== '') {
            nextHeaders[key] = String(value)
        }
    })

    if (!nextHeaders.accept) {
        nextHeaders.accept = 'text/plain, application/json, */*'
    }

    return nextHeaders
}

function applyCorsHeaders(res) {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, WWW-Authenticate, X-WWW-Authenticate')
    res.setHeader('Access-Control-Expose-Headers', 'Authorization, X-WWW-Authenticate')
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
    res.setHeader('Pragma', 'no-cache')
    res.setHeader('Expires', '0')
    res.setHeader('Surrogate-Control', 'no-store')
}

export default async function handler(req, res) {
    applyCorsHeaders(res)

    if (req.method === 'OPTIONS') {
        res.status(204).end()
        return
    }

    if (req.method !== 'GET') {
        res.status(405).json({ message: 'Method not allowed' })
        return
    }

    const targetUrl = new URL('cgi-bin/magicBox.cgi', getCameraBaseOrigin())
    Object.entries(req.query || {}).forEach(([key, value]) => {
        if (key === 'action' || value === undefined) {
            return
        }
        if (Array.isArray(value)) {
            value.forEach((entry) => targetUrl.searchParams.append(key, String(entry)))
            return
        }
        targetUrl.searchParams.append(key, String(value))
    })
    targetUrl.searchParams.set('action', 'getLanguageCaps')
    res.setHeader('x-proxy-target', targetUrl.toString())

    try {
        const upstream = await fetch(targetUrl.toString(), {
            method: 'GET',
            headers: sanitizeRequestHeaders(req.headers),
            redirect: 'manual',
        })

        upstream.headers.forEach((value, key) => {
            if (key.toLowerCase() === 'content-encoding') {
                return
            }
            if (['cache-control', 'etag', 'last-modified', 'expires', 'pragma'].includes(key.toLowerCase())) {
                return
            }
            if (key.toLowerCase() === 'www-authenticate') {
                res.setHeader('x-www-authenticate', value)
                return
            }
            res.setHeader(key, value)
        })

        const buffer = Buffer.from(await upstream.arrayBuffer())
        res.status(upstream.status).send(buffer)
    } catch (error) {
        res.status(502).json({
            message: 'Proxy request failed',
            detail: error?.message || 'Unknown error',
        })
    }
}
