import { getRequestUri } from './api-config'
import { buildDigestAuthorizationHeader, createCnonce, formatNc, parseDigestChallenge } from './auth-helper'
import { authStore } from '../stores/authSlice'

function getHeaderCaseInsensitive(headers = {}, key) {
    if (!headers) {
        return null
    }
    return headers[key] || headers[key.toLowerCase()] || headers[key.toUpperCase()]
}

function canUseDigest(state) {
    return Boolean(state?.isAuthenticated && state?.credentials?.username && state?.credentials?.password && state?.challenge?.nonce)
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

function appendDigestHeader(config, authState) {
    if (!canUseDigest(authState)) {
        return config
    }

    const nextCounter = (authState.nc || 0) + 1
    const nc = formatNc(nextCounter)
    const cnonce = createCnonce()
    const uri = getRequestUri(config.url || '/')
    const method = config.method || 'GET'
    const body = getBodyString(config.data)

    const authorization = buildDigestAuthorizationHeader({
        method,
        uri,
        username: authState.credentials.username,
        password: authState.credentials.password,
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
                authStore.actions.clearSession()
                throw error
            }

            if (response.status !== 401 || originalConfig.__digestRetried) {
                throw error
            }

            const authState = authStore.getState()
            if (!authState?.credentials?.username || !authState?.credentials?.password) {
                authStore.actions.clearSession()
                throw error
            }

            const authenticateHeader = getHeaderCaseInsensitive(response.headers, 'www-authenticate')
            const challenge = parseDigestChallenge(authenticateHeader || '')
            if (!challenge) {
                authStore.actions.clearSession()
                throw error
            }

            authStore.actions.updateChallenge(challenge)
            const refreshedState = authStore.getState()
            const retriedConfig = appendDigestHeader(
                {
                    ...originalConfig,
                    __digestRetried: true,
                },
                refreshedState,
            )

            return ApiClient.request(retriedConfig)
        },
    )
}
