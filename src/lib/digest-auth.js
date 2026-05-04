import { getRequestUri, shouldUseDigestForUrl } from './api-config'
import {
    buildDigestAuthorizationHeader,
    computeDigestSecret,
    createCnonce,
    formatNc,
    parseDigestChallenge,
} from './auth-helper'

const STREAM_URL_HINTS = ['.m3u8', 'playlist', 'manifest']
const nonceCounters = new Map()

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
    if (params && typeof params === 'object' && params.__path) {
        const rawPath = String(params.__path || '').trim().replace(/^\/+/, '')
        const digestPath = rawPath ? `/${rawPath}` : '/'

        const searchParams = new URLSearchParams()
        Object.entries(params).forEach(([key, value]) => {
            if (key === '__path' || value === undefined || value === null) {
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
        return nextQuery ? `${digestPath}?${nextQuery}` : digestPath
    }

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

function allocateNextNc(authState) {
    const nonceKey = String(authState?.challenge?.nonce || '')
    const stateNc = Number(authState?.nc || 0)
    const cachedNc = Number(nonceCounters.get(nonceKey) || 0)
    const base = Math.max(stateNc, cachedNc)
    const nextNc = base + 1
    nonceCounters.set(nonceKey, nextNc)
    return nextNc
}

export function createDigestSignedConfig(config, authState) {
    const digestUri = buildDigestUri(config?.url || '/', config?.params)
    if (!shouldUseDigestForUrl(digestUri)) {
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

    const nextNc = allocateNextNc(authState)
    const challenge = authState.challenge
    const digestSecret = resolveDigestSecret(authState, challenge)

    const authorization = buildDigestAuthorizationHeader({
        method: config.method || 'GET',
        uri: digestUri,
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

export function shouldSkipDigestRetry(url = '', params = {}) {
    const digestUri = buildDigestUri(url || '/', params || {})
    if (!shouldUseDigestForUrl(digestUri)) {
        return true
    }

    const normalizedUrl = String(digestUri || '').toLowerCase()
    return STREAM_URL_HINTS.some((token) => normalizedUrl.includes(token))
}
