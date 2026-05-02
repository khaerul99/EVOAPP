import { computeDigestSecret } from './auth-helper'
import {
    canSignWithDigest,
    createDigestSignedConfig,
    extractDigestChallenge,
    hasDigestCredentials,
    shouldSkipDigestRetry,
} from './digest-auth'
import { authStore } from '../stores/authSlice'

function signRequestWithDigest(config, authState) {
    const result = createDigestSignedConfig(config, authState)
    if (result.usedDigest) {
        authStore.actions.updateNc(result.nextNc)
    }
    return result.config
}

export function setupInterceptors(ApiClient) {
    ApiClient.interceptors.request.use((config) => {
        if (config?.__skipDigestSign) {
            return config
        }

        const authState = authStore.getState()
        return signRequestWithDigest(config, authState)
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

            if (shouldSkipDigestRetry(originalConfig.url || '')) {
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
