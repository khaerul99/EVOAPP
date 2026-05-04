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
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, WWW-Authenticate, X-WWW-Authenticate')
    res.setHeader('Access-Control-Expose-Headers', 'Authorization, X-WWW-Authenticate')
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
    res.setHeader('Pragma', 'no-cache')
    res.setHeader('Expires', '0')
    res.setHeader('Surrogate-Control', 'no-store')
}

function getRequestBody(req) {
    if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
        return undefined
    }
    if (req.body === undefined || req.body === null) {
        return undefined
    }
    if (typeof req.body === 'string' || Buffer.isBuffer(req.body)) {
        return req.body
    }
    return JSON.stringify(req.body)
}

function buildTargetUrl(query = {}) {
    const rawPath = String(query.__path || '').trim().replace(/^\/+/, '')
    if (!rawPath) {
        throw new Error('Missing __path query')
    }

    const targetUrl = new URL(rawPath, getCameraBaseOrigin())
    Object.entries(query).forEach(([key, value]) => {
        if (key === '__path' || value === undefined) {
            return
        }
        if (Array.isArray(value)) {
            value.forEach((entry) => targetUrl.searchParams.append(key, String(entry)))
            return
        }
        targetUrl.searchParams.append(key, String(value))
    })

    return targetUrl.toString()
}

export default async function handler(req, res) {
    applyCorsHeaders(res)

    if (req.method === 'OPTIONS') {
        res.status(204).end()
        return
    }

    let targetUrl = ''
    try {
        targetUrl = buildTargetUrl(req.query || {})
    } catch (error) {
        res.status(400).json({
            message: error?.message || 'Invalid proxy query',
        })
        return
    }

    const body = getRequestBody(req)
    res.setHeader('x-proxy-target', targetUrl)

    try {
        const upstream = await fetch(targetUrl, {
            method: req.method,
            headers: sanitizeRequestHeaders(req.headers),
            body,
            redirect: 'manual',
        })

        upstream.headers.forEach((value, key) => {
            if (key.toLowerCase() === 'content-encoding') {
                return
            }
            if (key.toLowerCase() === 'www-authenticate') {
                res.setHeader('x-www-authenticate', value)
                return
            }
            if (['cache-control', 'etag', 'last-modified', 'expires', 'pragma'].includes(key.toLowerCase())) {
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
