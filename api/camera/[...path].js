const CAMERA_TARGET = process.env.CAMERA_TARGET || 'http://103.194.172.70:8080'

function buildTargetUrl(pathSegments, queryObject) {
    const safeBase = CAMERA_TARGET.endsWith('/') ? CAMERA_TARGET : `${CAMERA_TARGET}/`
    const targetUrl = new URL(pathSegments.join('/'), safeBase)

    Object.entries(queryObject || {}).forEach(([key, value]) => {
        if (key === 'path' || key === '__path' || value === undefined) {
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

function buildTargetUrlFromRawRequest(req, pathSegments) {
    const safeBase = CAMERA_TARGET.endsWith('/') ? CAMERA_TARGET : `${CAMERA_TARGET}/`
    const targetUrl = new URL(pathSegments.join('/'), safeBase)

    let parsedRequestUrl
    try {
        parsedRequestUrl = new URL(req.url || '/', 'http://localhost')
    } catch {
        return buildTargetUrl(pathSegments, req.query)
    }

    parsedRequestUrl.searchParams.forEach((value, key) => {
        if (key === 'path' || key === '__path') {
            return
        }
        targetUrl.searchParams.append(key, value)
    })

    return targetUrl.toString()
}

function sanitizeRequestHeaders(headers) {
    // Forward only API-relevant headers to avoid camera UI fallback responses.
    const source = headers || {}
    const nextHeaders = {}

    const allowList = [
        'authorization',
        'content-type',
        'accept',
        'x-requested-with',
    ]

    allowList.forEach((key) => {
        const value = source[key] ?? source[key.toLowerCase()] ?? source[key.toUpperCase()]
        if (value !== undefined && value !== null && value !== '') {
            nextHeaders[key] = String(value)
        }
    })

    if (!nextHeaders.accept) {
        nextHeaders.accept = '*/*'
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

export default async function handler(req, res) {
    applyCorsHeaders(res)

    if (req.method === 'OPTIONS') {
        res.status(204).end()
        return
    }

    const encodedPath = String(req.query.__path || '').trim()
    const pathSegments = encodedPath
        ? encodedPath.split('/').filter(Boolean)
        : (Array.isArray(req.query.path)
            ? req.query.path
            : [req.query.path].filter(Boolean))

    const targetUrl = buildTargetUrlFromRawRequest(req, pathSegments)
    const body = getRequestBody(req)

    try {
        const upstream = await fetch(targetUrl, {
            method: req.method,
            headers: sanitizeRequestHeaders(req.headers),
            body,
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
