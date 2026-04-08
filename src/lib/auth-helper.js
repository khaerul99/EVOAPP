import CryptoJS from 'crypto-js'

export function md5(inputText) {
    return CryptoJS.MD5(String(inputText)).toString(CryptoJS.enc.Hex)
}

export function computeDigestSecret(username, realm, password) {
    return md5(`${username}:${realm}:${password}`)
}

export function parseDigestChallenge(headerValue = '') {
    const raw = String(headerValue || '').trim()
    if (!raw.toLowerCase().startsWith('digest ')) {
        return null
    }

    const digestValue = raw.slice(7)
    const tokenRegex = /([a-zA-Z0-9_-]+)=("([^"]*)"|([^,\s]+))/g
    const challenge = {}

    let match = tokenRegex.exec(digestValue)
    while (match) {
        const key = match[1]
        const value = match[3] ?? match[4] ?? ''
        challenge[key] = value
        match = tokenRegex.exec(digestValue)
    }

    if (!challenge.realm || !challenge.nonce) {
        return null
    }

    return {
        realm: challenge.realm,
        nonce: challenge.nonce,
        opaque: challenge.opaque || '',
        qop: challenge.qop || '',
        algorithm: challenge.algorithm || 'MD5',
    }
}

export function createCnonce() {
    const template = 'xxxxxxxxxxxx4xxxyxxxxxxxxxxxxxxx'
    return template.replace(/[xy]/g, (character) => {
        const random = Math.random() * 16 | 0
        const value = character === 'x' ? random : (random & 0x3 | 0x8)
        return value.toString(16)
    })
}

function normalizeQop(qopValue = '') {
    const values = qopValue
        .split(',')
        .map((value) => value.trim().toLowerCase())
        .filter(Boolean)

    if (values.includes('auth')) {
        return 'auth'
    }

    return values[0] || ''
}

export function formatNc(counter = 1) {
    return Number(counter).toString(16).padStart(8, '0')
}

export function buildDigestAuthorizationHeader({
    method = 'GET',
    uri,
    username,
    password,
    digestSecret,
    body = '',
    challenge,
    nc = '00000001',
    cnonce = createCnonce(),
}) {
    const normalizedMethod = method.toUpperCase()
    const selectedQop = normalizeQop(challenge.qop)
    const algorithm = (challenge.algorithm || 'MD5').toUpperCase()

    let ha1 = digestSecret || computeDigestSecret(username, challenge.realm, password)
    if (algorithm === 'MD5-SESS') {
        ha1 = md5(`${ha1}:${challenge.nonce}:${cnonce}`)
    }

    let ha2 = md5(`${normalizedMethod}:${uri}`)
    if (selectedQop === 'auth-int') {
        ha2 = md5(`${normalizedMethod}:${uri}:${md5(body || '')}`)
    }

    const response = selectedQop
        ? md5(`${ha1}:${challenge.nonce}:${nc}:${cnonce}:${selectedQop}:${ha2}`)
        : md5(`${ha1}:${challenge.nonce}:${ha2}`)

    const parts = [
        `username="${username}"`,
        `realm="${challenge.realm}"`,
        `nonce="${challenge.nonce}"`,
        `uri="${uri}"`,
        `response="${response}"`,
        `algorithm=${algorithm}`,
    ]

    if (selectedQop) {
        parts.push(`qop=${selectedQop}`)
        parts.push(`nc=${nc}`)
        parts.push(`cnonce="${cnonce}"`)
    }

    if (challenge.opaque) {
        parts.push(`opaque="${challenge.opaque}"`)
    }

    return `Digest ${parts.join(', ')}`
}
