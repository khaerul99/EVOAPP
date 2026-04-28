import { getRequestUri } from './api-config'
import { buildDigestAuthorizationHeader, computeDigestSecret, createCnonce, formatNc, parseDigestChallenge } from './auth-helper'
import { authStore } from '../stores/authSlice'

function getHeaderCaseInsensitive(headers = {}, key) {
    if (!headers) {
        return null
    }
    if (key.toLowerCase() === 'www-authenticate') {
        return headers['x-www-authenticate'] || headers['X-WWW-Authenticate'] || headers['X-Www-Authenticate'] || headers[key] || headers[key.toLowerCase()] || headers[key.toUpperCase()]
    }
    return headers[key] || headers[key.toLowerCase()] || headers[key.toUpperCase()]
}

function canUseDigest(state) {
    const hasSecret = Boolean(state?.auth?.digestSecret)
    const hasRuntimePassword = Boolean(state?.runtimeRtspPassword)
    return Boolean(state?.isAuthenticated && state?.auth?.username && (hasSecret || hasRuntimePassword) && state?.challenge?.nonce)
}

function getBodyString(data) {
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

function buildUriWithParams(url, params) {
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

function appendDigestHeader(config, authState) {
    if (!canUseDigest(authState)) {
        return config
    }

    const nextCounter = (authState.nc || 0) + 1
    const nc = formatNc(nextCounter)
    const cnonce = createCnonce()
    const uri = buildUriWithParams(config.url || '/', config.params)
    const method = config.method || 'GET'
    const body = getBodyString(config.data)

    const hasDigestSecret = Boolean(authState?.auth?.digestSecret)
    const digestSecret = hasDigestSecret
        ? authState.auth.digestSecret
        : computeDigestSecret(authState.auth.username, authState.challenge.realm, authState.runtimeRtspPassword || '')

    const authorization = buildDigestAuthorizationHeader({
        method,
        uri,
        username: authState.auth.username,
        digestSecret: digestSecret || undefined,
        password: hasDigestSecret ? undefined : (authState.runtimeRtspPassword || ''),
        body,
        challenge: authState.challenge,
        nc,
        cnonce,
    })

    const headers = { ...(config.headers || {}), Authorization: authorization }
    authStore.actions.updateNc(nextCounter)

    return {
        ...config,
        headers,
    }
}

export function setupInterceptors(ApiClient) {
    ApiClient.interceptors.request.use((config) => {
        const authState = authStore.getState()
        return appendDigestHeader(config, authState)
    })

    ApiClient.interceptors.response.use(
        (response) => response,
        async (error) => {
            const response = error?.response
            const originalConfig = error?.config || {}

            if (!response) {
                throw error
            }

            if (response.status === 403) {
                throw error
            }

            if (response.status !== 401) {
                throw error
            }

            if (originalConfig.__noRetry) {
                throw error
            }

            const requestUrl = String(originalConfig.url || '').toLowerCase()
            if (requestUrl.includes('.m3u8') || requestUrl.includes('playlist') || requestUrl.includes('manifest')) {
                throw error
            }

            const retryCount = Number(originalConfig.__digestRetryCount || 0)
            const maxRetry = 1
            if (retryCount >= maxRetry) {
                throw error
            }

            const authState = authStore.getState()
            if (!authState?.auth?.username || (!authState?.auth?.digestSecret && !authState?.runtimeRtspPassword)) {
                throw error
            }

            const authenticateHeader = getHeaderCaseInsensitive(response.headers, 'www-authenticate')
            const challenge = parseDigestChallenge(authenticateHeader || '')
            if (!challenge) {
                throw error
            }

            authStore.actions.updateChallenge(challenge)
            const refreshedState = authStore.getState()
            const retriedConfig = appendDigestHeader(
                {
                    ...originalConfig,
                    __digestRetryCount: retryCount + 1,
                },
                refreshedState,
            )

            if (!refreshedState?.auth?.digestSecret && refreshedState?.runtimeRtspPassword) {
                const computedSecret = computeDigestSecret(
                    refreshedState.auth.username,
                    challenge.realm,
                    refreshedState.runtimeRtspPassword,
                )
                authStore.actions.setSession({
                    username: refreshedState.auth.username,
                    digestSecret: computedSecret,
                    challenge,
                    rtspPassword: refreshedState.runtimeRtspPassword,
                })
            }

            return ApiClient.request(retriedConfig)
        },
    )
}
