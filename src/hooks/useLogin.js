import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { loginWithDigest } from '../services/auth.service'
import { useAuthActions, useStore } from '../stores/useStore'

const REMEMBER_KEY = 'evosecure_remember_username'

export function useLogin() {
    const navigate = useNavigate()
    const location = useLocation()
    const actions = useAuthActions()
    const isAuthenticated = useStore((state) => state.isAuthenticated)

    const [username, setUsername] = useState('')
    const [password, setPassword] = useState('')
    const [rememberMe, setRememberMe] = useState(false)
    const [showPassword, setShowPassword] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState('')

    const nextPath = useMemo(
        () => location.state?.from?.pathname || '/dashboard',
        [location.state],
    )

    useEffect(() => {
        const rememberedUsername = localStorage.getItem(REMEMBER_KEY)
        if (rememberedUsername) {
            setUsername(rememberedUsername)
            setRememberMe(true)
        }
    }, [])

    useEffect(() => {
        if (isAuthenticated) {
            navigate('/dashboard', { replace: true })
        }
    }, [isAuthenticated, navigate])

    const handleSubmit = async (event) => {
        event.preventDefault()
        setError('')
        setIsLoading(true)

        try {
            const authResult = await loginWithDigest(username, password)
            actions.setSession({
                username,
                password,
                challenge: authResult.challenge,
            })

            if (rememberMe) {
                localStorage.setItem(REMEMBER_KEY, username)
            } else {
                localStorage.removeItem(REMEMBER_KEY)
            }

            navigate(nextPath, { replace: true })
        } catch (requestError) {
            setError(requestError?.message || 'Login gagal. Coba lagi.')
        } finally {
            setIsLoading(false)
        }
    }

    return {
        username,
        password,
        rememberMe,
        showPassword,
        isLoading,
        error,
        setUsername,
        setPassword,
        setRememberMe,
        setShowPassword,
        handleSubmit,
    }
}
