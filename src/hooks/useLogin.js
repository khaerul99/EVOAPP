import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { cancelLoginRequest, loginWithDigest } from '../services/auth.service'
import { warmupDigestChallenge } from '../services/digest-warmup.service'
import { authStore } from '../stores/authSlice'
import { REMEMBER_KEY, getSession, saveSession } from '../lib/session-helper'
import { addSecurityLog } from '../lib/security-log'

const DIGEST_LOGIN_RETRY_DELAY_MS = 2500
const DIGEST_LOGIN_MAX_RETRY = 6

function sleep(milliseconds) {
    return new Promise((resolve) => {
        setTimeout(resolve, milliseconds)
    })
}

function isDigestTransientError(errorMessage) {
    const normalized = String(errorMessage || '').toLowerCase()
    return normalized.includes('header digest tidak ditemukan')
        || normalized.includes('network error')
        || normalized.includes('koneksi timeout')
}

export function useLogin() {
    const navigate = useNavigate()

    const [username, setUsername] = useState('')
    const [password, setPassword] = useState('')
    const [rememberMe, setRememberMe] = useState(false)
    const [showPassword, setShowPassword] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState('')
    const [loadingMessage, setLoadingMessage] = useState('')
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
        setLoadingMessage('Memverifikasi kredensial...')
        try {
            let loginResult = null
            let lastError = null

            for (let attempt = 0; attempt <= DIGEST_LOGIN_MAX_RETRY; attempt += 1) {
                try {
                    loginResult = await loginWithDigest(username, password)
                    lastError = null
                    break
                } catch (requestError) {
                    lastError = requestError
                    const errorMessage = requestError?.message || ''
                    const canAutoRetry = isDigestTransientError(errorMessage) && attempt < DIGEST_LOGIN_MAX_RETRY
                    if (!canAutoRetry) {
                        throw requestError
                    }

                    setLoadingMessage(`Autentikasi digest diproses, mencoba ulang otomatis... (${attempt + 1}/${DIGEST_LOGIN_MAX_RETRY})`)
                    await sleep(DIGEST_LOGIN_RETRY_DELAY_MS)
                }
            }

            if (!loginResult && lastError) {
                throw lastError
            }

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
            // Non-blocking warm-up to reduce first-hit 401 on feature endpoints.
            warmupDigestChallenge().catch(() => {})

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
            setLoadingMessage('')
            isSubmittingRef.current = false
        }
    }

    return {
        username,
        password,
        rememberMe,
        showPassword,
        isLoading,
        loadingMessage,
        error,
        setUsername,
        setPassword,
        setRememberMe,
        setShowPassword,
        handleSubmit,
    }
}
