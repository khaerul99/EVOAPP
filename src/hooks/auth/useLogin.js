import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { cancelLoginRequest, loginWithDigest } from '../../services/auth/auth.service'
import { authStore } from '../../stores/authSlice'
import { REMEMBER_KEY, clearSession, getRemainingLogoutCooldownMs, hasSession, saveSession } from '../../lib/session-helper'
import { addSecurityLog, getSecurityLogs } from '../../lib/security-log'

function sleep(milliseconds) {
    return new Promise((resolve) => {
        setTimeout(resolve, milliseconds)
    })
}

function extractLockSeconds(errorMessage) {
    const normalized = String(errorMessage || '')
    const match = normalized.match(/"?rmlock"?\s*[:=]\s*(\d+)/i)
    const value = Number(match?.[1] || 0)
    return Number.isFinite(value) && value > 0 ? value : 0
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
    const [lockoutUntil, setLockoutUntil] = useState(0)
    const [lockoutRemainingSec, setLockoutRemainingSec] = useState(0)
    const isSubmittingRef = useRef(false)
    const lastSubmitAtRef = useRef(0)

    useEffect(() => {
        if (lockoutUntil <= 0) {
            setLockoutRemainingSec(0)
            return undefined
        }

        const sync = () => {
            const remainingMs = Math.max(0, lockoutUntil - Date.now())
            setLockoutRemainingSec(Math.ceil(remainingMs / 1000))
            if (remainingMs <= 0) {
                setLockoutUntil(0)
            }
        }

        sync()
        const timer = setInterval(sync, 500)
        return () => clearInterval(timer)
    }, [lockoutUntil])

    useEffect(() => {
        if (hasSession()) {
            navigate('/dashboard', { replace: true })
            return
        }

        const rememberedUsername = localStorage.getItem(REMEMBER_KEY)
        if (rememberedUsername) {
            setUsername(rememberedUsername)
            setRememberMe(true)
        }
    }, [navigate])

    useEffect(() => () => cancelLoginRequest(), [])

    const handleSubmit = async (event) => {
        event.preventDefault()

        if (lockoutUntil > Date.now()) {
            const waitSeconds = Math.ceil((lockoutUntil - Date.now()) / 1000)
            setError(`Akun sedang terkunci. Coba lagi ${waitSeconds} detik.`)
            return
        }

        if (isSubmittingRef.current) {
            return
        }

        const now = Date.now()
        if (now - lastSubmitAtRef.current < 1500) {
            return
        }
        lastSubmitAtRef.current = now

        isSubmittingRef.current = true
        setError('')
        setIsLoading(true)
        setLoadingMessage('Memverifikasi kredensial...')

        try {
            clearSession({ silent: true, markLogoutAt: false })

            const remainingCooldownMs = getRemainingLogoutCooldownMs()
            if (remainingCooldownMs > 0) {
                setLoadingMessage(`Menunggu sinkronisasi logout ${Math.ceil(remainingCooldownMs / 1000)} detik...`)
                await sleep(remainingCooldownMs)
                setLoadingMessage('Memverifikasi kredensial...')
            }

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
                rtspPassword: password,
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
            const lockSeconds = extractLockSeconds(errorMessage)

            if (lockSeconds > 0) {
                setLockoutUntil(Date.now() + (lockSeconds * 1000))
                setError(`Akun terkunci sementara. Coba lagi ${lockSeconds} detik.`)
            } else {
                setError(errorMessage)
            }

            addSecurityLog({
                level: 'error',
                action: 'login_failed',
                message: errorMessage,
                username: username || '-',
            })

            const recentFailedLogins = getSecurityLogs().filter((log) => {
                return log?.action === 'login_failed' && (Date.now() - Number(log?.timestamp || 0)) <= 1000
            })

            if (recentFailedLogins.length >= 3) {
                addSecurityLog({
                    level: 'warning',
                    action: 'auth_retry_burst_detected',
                    message: `Terdeteksi ${recentFailedLogins.length} login gagal dalam 1 detik. Cek retry interceptor/auth flow.`,
                    username: username || '-',
                })
            }
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
        lockoutRemainingSec,
        error,
        setUsername,
        setPassword,
        setRememberMe,
        setShowPassword,
        handleSubmit,
    }
}
