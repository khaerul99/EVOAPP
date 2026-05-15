import AxiosDigest from 'axios-digest'
import axios from 'axios'
import { computeDigestSecret } from './auth-helper'
import {
    canSignWithDigest,
    createDigestSignedConfig,
    extractDigestChallenge,
    hasDigestCredentials,
    shouldSkipDigestRetry,
} from './digest-auth'
import { authStore } from '../stores/authSlice'
import { clearSession } from './session-helper'

function pickDigestPassword(authState) {
    return String(authState?.runtimeRtspPassword || '').trim()
}

function cloneHeaders(headers) {
    return {
        ...(headers || {}),
    }
}

function normalizeDigestChallengeHeaders(headers = {}) {
    const nextHeaders = cloneHeaders(headers)
    const digestChallenge = nextHeaders['www-authenticate']
        || nextHeaders['WWW-Authenticate']
        || nextHeaders['x-www-authenticate']
        || nextHeaders['X-WWW-Authenticate']
        || nextHeaders['X-Www-Authenticate']

    if (digestChallenge && !nextHeaders['www-authenticate']) {
        nextHeaders['www-authenticate'] = digestChallenge
    }

    return nextHeaders
}

async function retryWithAxiosDigest(originalConfig, authState) {
    const username = String(authState?.auth?.username || '').trim()
    const password = pickDigestPassword(authState)
    if (!username || !password) {
        return null
    }

    const axiosInstance = axios.create()
    axiosInstance.interceptors.response.use(
        (response) => response,
        (requestError) => {
            if (requestError?.response?.headers) {
                requestError.response.headers = normalizeDigestChallengeHeaders(requestError.response.headers)
            }
            return Promise.reject(requestError)
        },
    )

    const digestClient = new AxiosDigest(username, password, axiosInstance)
    const method = String(originalConfig?.method || 'get').toLowerCase()
    const requestConfig = {
        ...originalConfig,
        headers: normalizeDigestChallengeHeaders(originalConfig?.headers || {}),
        __skipDigestSign: true,
        __noRetry: true,
        __digestRetryCount: Number(originalConfig?.__digestRetryCount || 0) + 1,
    }

    if (method === 'get' || method === 'delete' || method === 'head') {
        return digestClient[method](originalConfig.url, requestConfig)
    }

    if (method === 'post' || method === 'put' || method === 'patch') {
        return digestClient[method](originalConfig.url, originalConfig.data, requestConfig)
    }

    return null
}

function routeRequestThroughProxy(config) {
    if (!import.meta.env.PROD) {
        return config
    }

    const originalUrl = String(config?.url || '').trim()
    if (!originalUrl || originalUrl.startsWith('/api/auth-probe') || originalUrl.startsWith('/api/proxy')) {
        return config
    }

    const parsed = new URL(originalUrl, window.location.origin)
    const requestPath = parsed.pathname.replace(/^\/+/, '')
    const nextParams = {
        ...(config.params || {}),
        __path: requestPath,
        _path: requestPath,
    }

    parsed.searchParams.forEach((value, key) => {
        if (nextParams[key] !== undefined) {
            return
        }
        nextParams[key] = value
    })

    return {
        ...config,
        baseURL: '/',
        url: '/api/proxy',
        params: nextParams,
    }
}

function signRequestWithDigest(config, authState) {
    const result = createDigestSignedConfig(config, authState)
    if (result.usedDigest) {
        authStore.actions.updateNc(result.nextNc)
    }
    return result.config
}

export function setupInterceptors(ApiClient) {
    ApiClient.interceptors.request.use((config) => {
        // Route the request through proxy first so the params (`__path` / `_path`) are present
        // then sign the routed config with digest so the `uri` used in the signature
        // matches the actual proxied camera target (including query string).
        const routed = routeRequestThroughProxy(config)

        if (routed?.__skipDigestSign) {
            return routed
        }

        const authState = authStore.getState()
        const signed = signRequestWithDigest(routed, authState)
        return signed
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

            if (shouldSkipDigestRetry(originalConfig.url || '', originalConfig.params || {})) {
                throw error
            }

            const retryCount = Number(originalConfig.__digestRetryCount || 0)
            const maxRetry = 1
            if (retryCount >= maxRetry) {
                // If we've exhausted digest retry attempts, treat as unrecoverable.
                // Clear session and notify the UI via a global event so the app can
                // show a login modal or redirect after in-flight requests finish.
                try {
                    const urlStr = String(originalConfig?.url || '')
                    const isInternalProbe = urlStr.startsWith('/api/auth-probe') || urlStr.startsWith('/api/proxy')
                    if (typeof window !== 'undefined' && !isInternalProbe) {
                        clearSession()
                        try {
                            window.dispatchEvent(new CustomEvent('evosecure:auth-expired', { detail: { reason: '401-exhausted' } }))
                        } catch {
                            // Fallback: set a simple flag on window
                            try { window.__evosecure_auth_expired = true } catch {}
                        }
                    }
                } catch {}

                throw error
            }

            const authState = authStore.getState()
            if (!hasDigestCredentials(authState)) {
                throw error
            }

            const challenge = extractDigestChallenge(response.headers)
            if (!challenge) {
                throw error
            }

            authStore.actions.updateChallenge(challenge)
            const refreshedState = authStore.getState()
            if (!canSignWithDigest(refreshedState)) {
                throw error
            }

            try {
                const digestResponse = await retryWithAxiosDigest(
                    routeRequestThroughProxy({
                        ...originalConfig,
                        __digestRetryCount: retryCount,
                    }),
                    refreshedState,
                )

                if (digestResponse) {
                    return digestResponse
                }
            } catch {
                // Fallback ke signer digest berbasis CryptoJS jika wrapper axios-digest gagal.
            }

            const retriedConfig = signRequestWithDigest(
                {
                    ...originalConfig,
                    __digestRetryCount: retryCount + 1,
                },
                refreshedState,
            )
            const routedRetriedConfig = routeRequestThroughProxy(retriedConfig)

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

            return ApiClient.request(routedRetriedConfig)
        },
    )
}
