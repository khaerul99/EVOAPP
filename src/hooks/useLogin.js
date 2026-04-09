import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { cancelLoginRequest, loginWithDigest } from '../services/auth.service'
import { authStore } from '../stores/authSlice'
import { REMEMBER_KEY, getSession, saveSession } from '../lib/session-helper'
import { addSecurityLog } from '../lib/security-log'

export function useLogin() {
    const navigate = useNavigate()

    const [username, setUsername] = useState('')
    const [password, setPassword] = useState('')
    const [rememberMe, setRememberMe] = useState(false)
    const [showPassword, setShowPassword] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState('')
    const isSubmittingRef = useRef(false)

    useEffect(() => {
        const session = getSession()
        if (session?.username) {
            navigate('/dashboard', { replace: true })
            return
        }

        const rememberedUsername = localStorage.getItem(REMEMBER_KEY)
        if (rememberedUsername) {
            setUsername(rememberedUsername)
            setRememberMe(true)
        }
    }, [navigate])

    useEffect(() => {
        return () => {
            cancelLoginRequest()
        }
    }, [])

    const handleSubmit = async (event) => {
        event.preventDefault()
        if (isSubmittingRef.current) {
            return
        }

        isSubmittingRef.current = true
        setError('')
        setIsLoading(true)
        try {
            const loginResult = await loginWithDigest(username, password)
            const sessionPayload = {
                username: loginResult?.username || username,
                loginAt: Date.now(),
            }

            saveSession(sessionPayload)
            authStore.actions.setSession({
                username: sessionPayload.username,
                digestSecret: loginResult?.digestSecret || null,
                challenge: loginResult?.challenge || null,
            })

            if (rememberMe) {
                localStorage.setItem(REMEMBER_KEY, username)
            } else {
                localStorage.removeItem(REMEMBER_KEY)
            }

            setPassword('')
            addSecurityLog({
                level: 'info',
                action: 'login_success',
                message: `Login berhasil untuk user ${sessionPayload.username}.`,
                username: sessionPayload.username,
            })
            navigate('/dashboard', { replace: true })
        } catch (requestError) {
            const errorMessage = requestError?.message || 'Username atau password salah.'
            setError(errorMessage)
            addSecurityLog({
                level: 'error',
                action: 'login_failed',
                message: errorMessage,
                username: username || '-',
            })
        } finally {
            setIsLoading(false)
            isSubmittingRef.current = false
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
