const SECURITY_LOG_KEY = 'evosecure_security_logs'
const MAX_LOGS = 200

export function getSecurityLogs() {
    try {
        const raw = localStorage.getItem(SECURITY_LOG_KEY)
        if (!raw) {
            return []
        }
        const parsed = JSON.parse(raw)
        return Array.isArray(parsed) ? parsed : []
    } catch {
        return []
    }
}

export function addSecurityLog(entry) {
    const logs = getSecurityLogs()
    const next = [
        {
            id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
            timestamp: Date.now(),
            level: 'info',
            action: 'event',
            message: '',
            ...entry,
        },
        ...logs,
    ].slice(0, MAX_LOGS)

    localStorage.setItem(SECURITY_LOG_KEY, JSON.stringify(next))
}

export function clearSecurityLogs() {
    localStorage.removeItem(SECURITY_LOG_KEY)
}
