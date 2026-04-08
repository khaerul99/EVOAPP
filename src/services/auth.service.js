import ApiClient from '../lib/api'
import {
    AUTH_FALLBACK_METHOD,
    AUTH_FALLBACK_PATH,
    AUTH_METHOD,
    AUTH_PROBE_PATH,
    getRequestUri,
} from '../lib/api-config'
import { buildDigestAuthorizationHeader, createCnonce, formatNc, parseDigestChallenge } from '../lib/auth-helper'

function getHeaderCaseInsensitive(headers, key) {
    if (!headers) {
        return null
    }
    return headers[key] || headers[key.toLowerCase()] || headers[key.toUpperCase()]
}

function toFriendlyError(status) {
    if (status === 401 || status === 403) {
        return 'Autentikasi ditolak (401/403). Cek username/password atau endpoint login device.'
    }
    if (status >= 500) {
        return 'Server device merespons error 5xx. Endpoint login kemungkinan tidak sesuai format.'
    }
    return `Autentikasi gagal (HTTP ${status}).`
}

async function executeDigestAttempt({
    endpointPath,
    method,
    username,
    password,
    payload,
}) {
    const bodyData = method === 'POST' ? (payload || {}) : undefined

    const firstResponse = await ApiClient.request({
        url: endpointPath,
        method,
        data: bodyData,
        headers: {
            'Content-Type': 'application/json',
        },
        validateStatus: () => true,
    })

    let challenge = parseDigestChallenge(getHeaderCaseInsensitive(firstResponse.headers, 'www-authenticate') || '')
    if (!challenge && firstResponse.status === 401) {
        return {
            ok: false,
            status: firstResponse.status,
            error: 'Server mengembalikan 401 tetapi header digest tidak ditemukan.',
        }
    }

    if (!challenge && firstResponse.status >= 200 && firstResponse.status < 300) {
        return {
            ok: true,
            username,
            challenge: null,
            endpoint: endpointPath,
            requiresDigest: false,
        }
    }

    if (!challenge) {
        return {
            ok: false,
            status: firstResponse.status,
            error: toFriendlyError(firstResponse.status),
        }
    }

    const authorization = buildDigestAuthorizationHeader({
        method,
        uri: getRequestUri(endpointPath),
        username,
        password,
        body: bodyData ? JSON.stringify(bodyData) : '',
        challenge,
        nc: formatNc(1),
        cnonce: createCnonce(),
    })

    const secondResponse = await ApiClient.request({
        url: endpointPath,
        method,
        data: bodyData,
        headers: {
            'Content-Type': 'application/json',
            Authorization: authorization,
        },
        validateStatus: () => true,
    })

    if (secondResponse.status < 200 || secondResponse.status >= 300) {
        return {
            ok: false,
            status: secondResponse.status,
            error: toFriendlyError(secondResponse.status),
        }
    }

    const nextChallenge = parseDigestChallenge(getHeaderCaseInsensitive(secondResponse.headers, 'www-authenticate') || '')

    return {
        ok: true,
        username,
        challenge: nextChallenge || challenge,
        endpoint: endpointPath,
        requiresDigest: true,
    }
}

export async function loginWithDigest(username, password) {
    if (!username || !password) {
        throw new Error('Username dan password wajib diisi.')
    }

    const attempts = [
        {
            endpointPath: AUTH_PROBE_PATH,
            method: AUTH_METHOD,
            payload: {},
        },
    ]

    if (AUTH_FALLBACK_PATH !== AUTH_PROBE_PATH) {
        attempts.push({
            endpointPath: AUTH_FALLBACK_PATH,
            method: AUTH_FALLBACK_METHOD,
            payload: {},
        })
    }

    let lastError = 'Autentikasi gagal.'
    for (const attempt of attempts) {
        const result = await executeDigestAttempt({
            ...attempt,
            username,
            password,
        })

        if (result.ok) {
            return result
        }
        lastError = result.error || lastError
    }

    throw new Error(lastError)
}

export async function logout() {
    return Promise.resolve()
}
