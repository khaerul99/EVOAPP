import { getRequestUri, shouldUseDigestForUrl } from './api-config'
import {
    buildDigestAuthorizationHeader,
    computeDigestSecret,
    createCnonce,
    formatNc,
    parseDigestChallenge,
} from './auth-helper'

const STREAM_URL_HINTS = ['.m3u8', 'playlist', 'manifest']

export function getHeaderCaseInsensitive(headers = {}, key = '') {
    if (!headers || !key) {
        return null
    }

    const loweredKey = key.toLowerCase()
    if (loweredKey === 'www-authenticate') {
        return (
            headers['x-www-authenticate']
            || headers['X-WWW-Authenticate']
            || headers['X-Www-Authenticate']
            || headers[key]
            || headers[loweredKey]
            || headers[key.toUpperCase()]
        )
    }

    return headers[key] || headers[loweredKey] || headers[key.toUpperCase()]
}

export function extractDigestChallenge(headers = {}) {
    const authenticateHeader = getHeaderCaseInsensitive(headers, 'www-authenticate')
    return parseDigestChallenge(authenticateHeader || '')
}

export function hasDigestCredentials(authState) {
    return Boolean(
        authState?.auth?.username
        && (authState?.auth?.digestSecret || authState?.runtimeRtspPassword),
    )
}

export function canSignWithDigest(authState) {
    return Boolean(
        authState?.isAuthenticated
        && hasDigestCredentials(authState)
        && authState?.challenge?.nonce,
    )
}

function stringifyRequestBody(data) {
    if (!data) {
        return ''
    }

    if (typeof data === 'string') {
        return data
    }

    try {
        return JSON.stringify(data)
    } catch {
        return ''
    }
}

function buildDigestUri(url, params) {
    const baseUri = getRequestUri(url || '/')
    if (!params || typeof params !== 'object') {
        return baseUri
    }

    const [pathOnly, existingQuery = ''] = String(baseUri).split('?')
    const searchParams = new URLSearchParams(existingQuery)

    Object.entries(params).forEach(([key, value]) => {
        if (value === undefined || value === null) {
            return
        }

        if (Array.isArray(value)) {
            value.forEach((entry) => {
                if (entry === undefined || entry === null) {
                    return
                }
                searchParams.append(key, String(entry))
            })
            return
        }

        searchParams.append(key, String(value))
    })

    const nextQuery = searchParams.toString()
    return nextQuery ? `${pathOnly}?${nextQuery}` : pathOnly
}

function resolveDigestSecret(authState, challenge) {
    const hasPrecomputedSecret = Boolean(authState?.auth?.digestSecret)
    if (hasPrecomputedSecret) {
        return authState.auth.digestSecret
    }

    return computeDigestSecret(
        authState?.auth?.username || '',
        challenge?.realm || authState?.challenge?.realm || '',
        authState?.runtimeRtspPassword || '',
    )
}

export function createDigestSignedConfig(config, authState) {
    if (!shouldUseDigestForUrl(config?.url || '/')) {
        return {
            config,
            usedDigest: false,
            nextNc: Number(authState?.nc || 0),
        }
    }

    if (!canSignWithDigest(authState)) {
        return {
            config,
            usedDigest: false,
            nextNc: Number(authState?.nc || 0),
        }
    }

    const nextNc = Number(authState?.nc || 0) + 1
    const challenge = authState.challenge
    const digestSecret = resolveDigestSecret(authState, challenge)

    const authorization = buildDigestAuthorizationHeader({
        method: config.method || 'GET',
        uri: buildDigestUri(config.url || '/', config.params),
        username: authState.auth.username,
        digestSecret: digestSecret || undefined,
        password: authState.auth?.digestSecret ? undefined : (authState.runtimeRtspPassword || ''),
        body: stringifyRequestBody(config.data),
        challenge,
        nc: formatNc(nextNc),
        cnonce: createCnonce(),
    })

    return {
        usedDigest: true,
        nextNc,
        config: {
            ...config,
            headers: {
                ...(config.headers || {}),
                Authorization: authorization,
            },
        },
    }
}

export function shouldSkipDigestRetry(url = '') {
    if (!shouldUseDigestForUrl(url)) {
        return true
    }

    const normalizedUrl = String(url || '').toLowerCase()
    return STREAM_URL_HINTS.some((token) => normalizedUrl.includes(token))
}
