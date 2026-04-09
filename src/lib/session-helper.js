import { authStore } from '../stores/authSlice'
import { addSecurityLog } from './security-log'

export const SESSION_KEY = 'evosecure_session'
export const REMEMBER_KEY = 'evosecure_remember_username'

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

export function hasSession() {
    const session = getSession()
    return Boolean(session?.username)
}

export function saveSession(session) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session))
}

export function clearSession() {
    const currentSession = getSession()
    localStorage.removeItem(SESSION_KEY)
    localStorage.removeItem('dahua-auth')
    authStore.actions.clearSession()
    addSecurityLog({
        level: 'warning',
        action: 'logout',
        message: `Logout user ${currentSession?.username || '-'}.`,
        username: currentSession?.username || '-',
    })
}
