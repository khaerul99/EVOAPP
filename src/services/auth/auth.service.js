import axios from 'axios'
import ApiClient from '../../lib/api'
import { AUTH_METHOD, AUTH_PROBE_DIGEST_URI, AUTH_PROBE_PATH, getRequestUri } from '../../lib/api-config'
import {
    buildDigestAuthorizationHeader,
    computeDigestSecret,
    createCnonce,
    formatNc,
    parseDigestChallenge,
} from '../../lib/auth-helper'

const authHttp = axios.create({
    baseURL: '/',
    timeout: ApiClient.defaults.timeout || 10000,
})

let activeLoginController = null

function getHeaderCaseInsensitive(headers, key) {
    if (!headers) {
        return null
    }
    if (key.toLowerCase() === 'www-authenticate') {
        return (
            headers['x-www-authenticate']
            || headers['X-WWW-Authenticate']
            || headers[key]
            || headers[key.toLowerCase()]
            || headers[key.toUpperCase()]
        )
    }
    return headers[key] || headers[key.toLowerCase()] || headers[key.toUpperCase()]
}

function toFriendlyError(status) {
    if (status === 401 || status === 403) {
        return 'Username atau password salah.'
    }
    if (status >= 500) {
        return 'Server sedang bermasalah. Coba beberapa saat lagi.'
    }
    return `Autentikasi gagal (HTTP ${status}).`
}

function cleanMessage(input) {
    return String(input || '')
        .replace(/\s+/g, ' ')
        .replace(/<[^>]*>/g, ' ')
        .trim()
}

function extractBackendError(response) {
    const headerMessage = getHeaderCaseInsensitive(response?.headers, 'x-error-message')
        || getHeaderCaseInsensitive(response?.headers, 'error-message')

    if (headerMessage) {
        return cleanMessage(headerMessage)
    }

    const data = response?.data
    if (!data) {
        return ''
    }

    if (typeof data === 'string') {
        const normalized = cleanMessage(data)
        if (!normalized) {
            return ''
        }
        if (normalized.startsWith('<!doctype html') || normalized.startsWith('<html')) {
            return ''
        }
        return normalized.slice(0, 240)
    }

    if (typeof data === 'object') {
        const nestedError = data.error && typeof data.error === 'object'
            ? (data.error.message || data.error.code || data.error.id)
            : null
        const candidates = [
            data.message,
            nestedError,
            typeof data.error === 'string' ? data.error : null,
            data.msg,
            data.detail,
            data.description,
            data.reason,
            data.errorMsg,
            data.errorMessage,
        ].filter(Boolean)

        if (candidates.length > 0) {
            return cleanMessage(candidates[0]).slice(0, 240)
        }
    }

    return ''
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

async function sendPlainRequest({ endpointPath, method, bodyData, signal }) {
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
    }).finally(() => {
            console.log('[DEBUG] sendPlainRequest - endpointPath:', endpointPath, 'baseURL:', authHttp.defaults.baseURL)
    })
}

async function sendDigestRequest({
    endpointPath,
    digestUriOverride,
    method,
    bodyData,
    username,
    password,
    challenge,
    signal,
}) {
    const authorization = buildDigestAuthorizationHeader({
        method,
        uri: digestUriOverride || getRequestUri(endpointPath),
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

async function executeDigestAttempt({ endpointPath, digestUriOverride, method, username, password, payload, signal }) {
    const bodyData = method === 'POST'
        ? (payload || { username, userName: username, password })
        : undefined

    const firstResponse = await sendPlainRequest({ endpointPath, method, bodyData, signal })
    let challenge = parseDigestChallenge(getHeaderCaseInsensitive(firstResponse.headers, 'www-authenticate') || '')

    if (!challenge && firstResponse.status >= 200 && firstResponse.status < 300) {
        if (isHtmlPayload(firstResponse)) {
            return {
                ok: false,
                status: firstResponse.status,
                error: 'Endpoint login tidak valid',
            }
        }

        return {
            ok: true,
            username,
            challenge: null,
            digestSecret: null,
            endpoint: endpointPath,
            requiresDigest: false,
        }
    }

    if (!challenge) {
        const backendError = extractBackendError(firstResponse)
        return {
            ok: false,
            status: firstResponse.status,
            error: backendError || (firstResponse.status === 401
                ? 'Server mengembalikan 401 tetapi header digest tidak ditemukan.'
                : toFriendlyError(firstResponse.status)),
        }
    }

    let lastStatus = firstResponse.status
    for (let round = 0; round < 1; round += 1) {
        const digestResponse = await sendDigestRequest({
            endpointPath,
            digestUriOverride,
            method,
            bodyData,
            username,
            password,
            challenge,
            signal,
        })

        lastStatus = digestResponse.status

        if (digestResponse.status >= 200 && digestResponse.status < 300) {
            const nextChallenge = parseDigestChallenge(
                getHeaderCaseInsensitive(digestResponse.headers, 'www-authenticate') || '',
            )
            const effectiveChallenge = nextChallenge || challenge

            return {
                ok: true,
                username,
                challenge: effectiveChallenge,
                digestSecret: computeDigestSecret(username, effectiveChallenge.realm, password),
                endpoint: endpointPath,
                requiresDigest: true,
            }
        }

        if (digestResponse.status !== 401) {
            const backendError = extractBackendError(digestResponse)
            return {
                ok: false,
                status: digestResponse.status,
                error: backendError || toFriendlyError(digestResponse.status),
            }
        }

        const refreshedChallenge = parseDigestChallenge(
            getHeaderCaseInsensitive(digestResponse.headers, 'www-authenticate') || '',
        )
        if (!refreshedChallenge) {
            const backendError = extractBackendError(digestResponse)
            return {
                ok: false,
                status: digestResponse.status,
                error: backendError || 'Server mengembalikan 401 tetapi header digest tidak ditemukan.',
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
        let lastError = 'Autentikasi gagal.'

        for (let attempt = 0; attempt < 1; attempt += 1) {
            const endpointPath = withCacheBust(AUTH_PROBE_PATH)
            const result = await executeDigestAttempt({
                endpointPath,
                digestUriOverride: AUTH_PROBE_DIGEST_URI,
                method: AUTH_METHOD,
                payload: { username, userName: username, password },
                username,
                password,
                signal,
            })

            if (result.ok) {
                return result
            }

            lastError = result.error || lastError

            if (String(lastError).toLowerCase().includes('endpoint login tidak valid')) {
                break
            }
        }

        throw new Error(lastError)
    } catch (error) {
        if (error?.code === 'ERR_CANCELED') {
            throw new Error('Permintaan login dibatalkan.')
        }
        if (error?.code === 'ECONNABORTED') {
            throw new Error('Koneksi timeout. Cek jaringan lalu coba lagi.')
        }
        if (error?.message === 'Network Error') {
            throw new Error('Tidak bisa terhubung ke server. Cek koneksi jaringan.')
        }
        throw error
    } finally {
        if (activeLoginController?.signal === signal) {
            activeLoginController = null
        }
    }
}

export function cancelLoginRequest() {
    if (activeLoginController) {
        activeLoginController.abort()
        activeLoginController = null
    }
}
