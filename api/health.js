const CAMERA_TARGET = process.env.CAMERA_TARGET || 'http://103.194.172.70:8080'

function getCameraBaseOrigin() {
    try {
        const parsed = new URL(CAMERA_TARGET)
        return `${parsed.protocol}//${parsed.host}`
    } catch {
        return 'http://103.194.172.70:8080'
    }
}

export default async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store')

    const origin = getCameraBaseOrigin()
    const probeUrl = `${origin}/cgi-bin/magicBox.cgi?action=getLanguageCaps`

    let probe = { ok: false }
    try {
        const upstream = await fetch(probeUrl, { method: 'GET', redirect: 'manual' })
        const text = await upstream.text()
        probe = {
            ok: upstream.status >= 200 && upstream.status < 500,
            status: upstream.status,
            contentType: upstream.headers.get('content-type') || '',
            startsWithHtml: /^\s*<!doctype html|^\s*<html/i.test(text),
            sample: text.slice(0, 120),
        }
    } catch (error) {
        probe = {
            ok: false,
            error: error?.message || 'Unknown error',
        }
    }

    res.status(200).json({
        ok: true,
        now: new Date().toISOString(),
        cameraTargetRaw: CAMERA_TARGET,
        cameraOriginResolved: origin,
        probe,
    })
}
