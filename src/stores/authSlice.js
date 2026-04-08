import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const AUTH_STORAGE_KEY = 'evosecure_auth_state'

const defaultState = {
    isAuthenticated: false,
    user: null,
    credentials: null,
    challenge: null,
    nc: 0,
    loginAt: null,
}

export const useAuthStore = create(
    persist(
        (set) => ({
            ...defaultState,
            setSession: ({ username, password, challenge }) =>
                set((state) => ({
                    ...state,
                    isAuthenticated: true,
                    user: { username },
                    credentials: { username, password },
                    challenge: challenge || state.challenge,
                    nc: 0,
                    loginAt: Date.now(),
                })),
            updateChallenge: (challenge) =>
                set((state) => ({
                    ...state,
                    challenge,
                    nc: 0,
                })),
            updateNc: (nc) =>
                set((state) => ({
                    ...state,
                    nc,
                })),
            clearSession: () =>
                set(() => ({
                    ...defaultState,
                })),
        }),
        {
            name: AUTH_STORAGE_KEY,
            partialize: (state) => ({
                isAuthenticated: state.isAuthenticated,
                user: state.user,
                credentials: state.credentials,
                challenge: state.challenge,
                nc: state.nc,
                loginAt: state.loginAt,
            }),
        },
    ),
)

export const authStore = {
    getState: useAuthStore.getState,
    subscribe: useAuthStore.subscribe,
    actions: {
        setSession(payload) {
            useAuthStore.getState().setSession(payload)
        },
        updateChallenge(challenge) {
            useAuthStore.getState().updateChallenge(challenge)
        },
        updateNc(nc) {
            useAuthStore.getState().updateNc(nc)
        },
        clearSession() {
            useAuthStore.getState().clearSession()
        },
    },
}
