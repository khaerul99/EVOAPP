import { computeDigestSecret } from './auth-helper'
import {
    canSignWithDigest,
    createDigestSignedConfig,
    extractDigestChallenge,
    hasDigestCredentials,
    shouldSkipDigestRetry,
} from './digest-auth'
import { authStore } from '../stores/authSlice'

let digestDispatchQueue = Promise.resolve()

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
    return result
}

async function enqueueDigestDispatchIfNeeded(config) {
    if (!import.meta.env.PROD) {
        return config
    }

    const authorization = String(config?.headers?.Authorization || '')
    if (!authorization.toLowerCase().startsWith('digest ')) {
        return config
    }

    let release = null
    const waitTurn = digestDispatchQueue
    digestDispatchQueue = new Promise((resolve) => {
        release = resolve
    })

    await waitTurn
    return {
        ...config,
        __digestQueueRelease: release,
    }
}

function releaseDigestDispatch(config) {
    const release = config?.__digestQueueRelease
    if (typeof release === 'function') {
        release()
    }
}

export function setupInterceptors(ApiClient) {
    ApiClient.interceptors.request.use(async (config) => {
        if (config?.__skipDigestSign) {
            return config
        }

        const authState = authStore.getState()
        const signedResult = signRequestWithDigest(config, authState)
        const routed = routeRequestThroughProxy(signedResult.config)
        return enqueueDigestDispatchIfNeeded(routed)
    })

    ApiClient.interceptors.response.use(
        (response) => {
            releaseDigestDispatch(response?.config || {})
            return response
        },
        async (error) => {
            const response = error?.response
            const originalConfig = error?.config || {}
            releaseDigestDispatch(originalConfig)

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

            const retriedConfig = signRequestWithDigest(
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
