import { useAuthStore } from './authSlice'
import { clearSession } from '../lib/session-helper'
import { logout as logoutService } from '../services/auth.service'

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

export async function logout() {
    const currentUser = useAuthStore.getState().auth
    try {
        if (currentUser?.username) {
            await logoutService(currentUser.username)
        }
    } finally {
        clearSession()
    }
}
