import { useAuthStore } from './authSlice'

export function useStore(selector = (snapshot) => snapshot) {
    return useAuthStore(selector)
}

export function useAuthActions() {
    const state = useAuthStore.getState()
    return {
        setSession: state.setSession,
        updateChallenge: state.updateChallenge,
        updateNc: state.updateNc,
        clearSession: state.clearSession,
    }
}
