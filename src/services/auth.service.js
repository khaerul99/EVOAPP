import axios from 'axios'
import ApiClient from '../lib/api'
import {
    AUTH_METHOD,
    AUTH_PROBE_PATH,
    getRequestUri,
} from '../lib/api-config'
import { buildDigestAuthorizationHeader, createCnonce, formatNc, parseDigestChallenge } from '../lib/auth-helper'

const authHttp = axios.create({
    baseURL: ApiClient.defaults.baseURL,
    timeout: ApiClient.defaults.timeout || 10000,
})
let activeLoginController = null

function getHeaderCaseInsensitive(headers, key) {
    if (!headers) {
        return null
    }
    if (key.toLowerCase() === 'www-authenticate') {
        return headers['x-www-authenticate'] || headers['X-WWW-Authenticate'] || headers[key] || headers[key.toLowerCase()] || headers[key.toUpperCase()]
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

function isHtmlPayload(response) {
    const contentType = String(getHeaderCaseInsensitive(response?.headers, 'content-type') || '').toLowerCase()
    if (!contentType.includes('text/html')) {
        return false
    }
    const bodyText = String(response?.data || '').toLowerCase()
    return bodyText.includes('<!doctype html') || bodyText.includes('<html')
}

function withCacheBust(endpointPath) {
    const separator = endpointPath.includes('?') ? '&' : '?'
    return `${endpointPath}${separator}_cb=${Date.now()}${Math.floor(Math.random() * 10000)}`
}

async function sendDigestRequest({
    endpointPath,
    method,
    bodyData,
    username,
    password,
    challenge,
    signal,
}) {
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

    return authHttp.request({
        url: endpointPath,
        method,
        data: bodyData,
        signal,
        headers: {
            'Content-Type': 'application/json',
            Authorization: authorization,
            'Cache-Control': 'no-cache, no-store',
            Pragma: 'no-cache',
        },
        validateStatus: () => true,
    })
}

async function sendPlainRequest({
    endpointPath,
    method,
    bodyData,
    signal,
}) {
    return authHttp.request({
        url: endpointPath,
        method,
        data: bodyData,
        signal,
        headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache, no-store',
            Pragma: 'no-cache',
        },
        validateStatus: () => true,
    })
}

async function executeDigestAttempt({
    endpointPath,
    method,
    username,
    password,
    payload,
    signal,
}) {
    const bodyData = method === 'POST'
        ? (payload || {
            username,
            userName: username,
            password,
        })
        : undefined
    const firstResponse = await sendPlainRequest({ endpointPath, method, bodyData, signal })

    let challenge = parseDigestChallenge(getHeaderCaseInsensitive(firstResponse.headers, 'www-authenticate') || '')

    if (!challenge && firstResponse.status >= 200 && firstResponse.status < 300) {
        if (isHtmlPayload(firstResponse)) {
            return {
                ok: false,
                status: firstResponse.status,
                error: 'Endpoint login tidak valid (mengembalikan halaman HTML, bukan respons autentikasi).',
            }
        }

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
            error: firstResponse.status === 401
                ? 'Server mengembalikan 401 tetapi header digest tidak ditemukan.'
                : toFriendlyError(firstResponse.status),
        }
    }

    let lastStatus = firstResponse.status
    for (let round = 0; round < 4; round += 1) {
        const digestResponse = await sendDigestRequest({
            endpointPath,
            method,
            bodyData,
            username,
            password,
            challenge,
            signal,
        })
        lastStatus = digestResponse.status

        if (digestResponse.status >= 200 && digestResponse.status < 300) {
            const nextChallenge = parseDigestChallenge(getHeaderCaseInsensitive(digestResponse.headers, 'www-authenticate') || '')
            return {
                ok: true,
                username,
                challenge: nextChallenge || challenge,
                endpoint: endpointPath,
                requiresDigest: true,
            }
        }

        if (digestResponse.status !== 401) {
            return {
                ok: false,
                status: digestResponse.status,
                error: toFriendlyError(digestResponse.status),
            }
        }

        const refreshedChallenge = parseDigestChallenge(
            getHeaderCaseInsensitive(digestResponse.headers, 'www-authenticate') || '',
        )
        if (!refreshedChallenge) {
            return {
                ok: false,
                status: digestResponse.status,
                error: 'Server mengembalikan 401 tetapi header digest tidak ditemukan.',
            }
        }
        challenge = refreshedChallenge
    }

    return {
        ok: false,
        status: lastStatus,
        error: toFriendlyError(lastStatus),
    }
}

export async function loginWithDigest(username, password) {
    if (!username || !password) {
        throw new Error('Username dan password wajib diisi.')
    }

    if (activeLoginController) {
        activeLoginController.abort()
    }
    activeLoginController = new AbortController()
    const { signal } = activeLoginController

    try {
        const endpointPath = withCacheBust(AUTH_PROBE_PATH)
        const result = await executeDigestAttempt({
            endpointPath,
            method: AUTH_METHOD,
            payload: {
                username,
                userName: username,
                password,
            },
            username,
            password,
            signal,
        })

        if (result.ok) {
            return result
        }

        throw new Error(result.error || 'Autentikasi gagal.')
    } catch (error) {
        if (error?.code === 'ERR_CANCELED') {
            throw new Error('Permintaan login dibatalkan.')
        }
        throw error
    } finally {
        if (activeLoginController?.signal === signal) {
            activeLoginController = null
        }
    }
}

export async function logout() {
    return Promise.resolve()
}

export function cancelLoginRequest() {
    if (activeLoginController) {
        activeLoginController.abort()
        activeLoginController = null
    }
}
