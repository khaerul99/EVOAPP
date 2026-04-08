const CAMERA_TARGET = process.env.CAMERA_TARGET || 'http://103.194.172.70:8080'

function buildTargetUrl(pathSegments, queryObject) {
    const safeBase = CAMERA_TARGET.endsWith('/') ? CAMERA_TARGET : `${CAMERA_TARGET}/`
    const targetUrl = new URL(pathSegments.join('/'), safeBase)

    Object.entries(queryObject || {}).forEach(([key, value]) => {
        if (key === 'path' || value === undefined) {
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

function sanitizeRequestHeaders(headers) {
    const nextHeaders = { ...headers }
    delete nextHeaders.host
    delete nextHeaders.connection
    delete nextHeaders['content-length']
    delete nextHeaders['x-forwarded-for']
    delete nextHeaders['x-forwarded-host']
    delete nextHeaders['x-forwarded-port']
    delete nextHeaders['x-forwarded-proto']
    return nextHeaders
}

function applyCorsHeaders(res) {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, WWW-Authenticate')
    res.setHeader('Access-Control-Expose-Headers', 'WWW-Authenticate, Authorization')
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

    const pathSegments = Array.isArray(req.query.path)
        ? req.query.path
        : [req.query.path].filter(Boolean)

    const targetUrl = buildTargetUrl(pathSegments, req.query)
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
