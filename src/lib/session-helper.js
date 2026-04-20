import { authStore } from '../stores/authSlice'
import { addSecurityLog } from './security-log'

export const SESSION_KEY = 'evosecure_session'
export const REMEMBER_KEY = 'evosecure_remember_username'
export const SESSION_MAX_AGE_MS = 24 * 60 * 60 * 1000
export const LAST_LOGOUT_AT_KEY = 'evosecure_last_logout_at'
export const LOGOUT_COOLDOWN_MS = 5000

export function getSession() {
    try {
        const raw = localStorage.getItem(SESSION_KEY)
        if (!raw) {
            return null
        }
        return JSON.parse(raw)
    } catch {
        return null
    }
}
    
export function isSessionExpired(session) {
    if (!session?.username) {
        return true
    }

    if (typeof session.loginAt !== 'number') {
        return true
    }

    return (Date.now() - session.loginAt) >= SESSION_MAX_AGE_MS
}

export function hasSession() {
    const session = getSession()
    if (!session?.username) {
        return false
    }

    const authState = authStore.getState()
    const hasDigestSession = Boolean(
        authState?.isAuthenticated
        && authState?.auth?.username
        && authState?.auth?.digestSecret
        && authState?.challenge?.nonce,
    )

    if (!hasDigestSession) {
        clearSession()
        return false
    }

    if (isSessionExpired(session)) {
        clearSession()
        return false
    }

    return true
}

export function saveSession(session) {
    localStorage.setItem(
        SESSION_KEY,
        JSON.stringify({
            ...session,
            loginAt: typeof session?.loginAt === 'number' ? session.loginAt : Date.now(),
        }),
    )
}

export function getRemainingLogoutCooldownMs(now = Date.now()) {
    try {
        const lastLogoutAtRaw = sessionStorage.getItem(LAST_LOGOUT_AT_KEY)
        const lastLogoutAt = Number(lastLogoutAtRaw || 0)
        if (!Number.isFinite(lastLogoutAt) || lastLogoutAt <= 0) {
            return 0
        }

        const elapsed = now - lastLogoutAt
        if (elapsed >= LOGOUT_COOLDOWN_MS) {
            return 0
        }

        return Math.max(0, LOGOUT_COOLDOWN_MS - elapsed)
    } catch {
        return 0
    }
}

export function clearSession(options = {}) {
    const { silent = false, markLogoutAt = true } = options
    const currentSession = getSession()
    const now = Date.now()
    localStorage.removeItem(SESSION_KEY)
    localStorage.removeItem('evosecure_auth_state')
    sessionStorage.removeItem('evosecure_auth_state')
    if (markLogoutAt) {
        sessionStorage.setItem(LAST_LOGOUT_AT_KEY, String(now))
    }
    authStore.actions.clearSession()
    if (!silent) {
        addSecurityLog({
            level: 'warning',
            action: 'logout',
            message: `Logout user ${currentSession?.username || '-'}.`,
            username: currentSession?.username || '-',
        })
    }
}
