import { authStore } from '../stores/authSlice'
import { addSecurityLog } from './security-log'

export const SESSION_KEY = 'evosecure_session'
export const REMEMBER_KEY = 'evosecure_remember_username'
export const SESSION_MAX_AGE_MS = 24 * 60 * 60 * 1000

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

    // Login timestamp is mandatory to enforce 24-hour session expiry.
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

export function clearSession() {
    const currentSession = getSession()
    localStorage.removeItem(SESSION_KEY)
    // localStorage.removeItem('dahua-auth')
    authStore.actions.clearSession()
    addSecurityLog({
        level: 'warning',
        action: 'logout',
        message: `Logout user ${currentSession?.username || '-'}.`,
        username: currentSession?.username || '-',
    })
}
