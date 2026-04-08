import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { logout as logoutService } from '../services/auth.service'
import { useAuthActions, useStore } from '../stores/useStore'

export function useDashboard() {
    const navigate = useNavigate()
    const actions = useAuthActions()
    const user = useStore((state) => state.user)

    const username = useMemo(() => user?.username || 'admin', [user])

    const logout = async () => {
        await logoutService()
        actions.clearSession()
        navigate('/login', { replace: true })
    }

    return {
        username,
        logout,
    }
}
