import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { cancelLoginRequest, loginWithDigest } from '../../services/auth/auth.service'
import { permissionService } from '../../services/user/permission.service'
import { authStore } from '../../stores/authSlice'
import { REMEMBER_KEY, clearSession, getRemainingLogoutCooldownMs, hasSession, saveSession, startIdleMonitoring } from '../../lib/session-helper'
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

            // Fetch user authorities/roles from device and attach to auth state.
            try {
                const userInfoResponse = await permissionService.getUserInfo(sessionPayload.username)
                
                // Try to unwrap nested 'user' object if it exists
                const userInfo = userInfoResponse?.user || userInfoResponse
                
                const groupName = String(
                    userInfo?.GroupName
                    || userInfo?.groupName
                    || userInfo?.Group
                    || userInfo?.group
                    || userInfo?.UserGroup
                    || userInfo?.userGroup
                    || userInfo?.UserGroupName
                    || userInfo?.userGroupName
                    || userInfo?.group_name
                    || userInfo?.['user.Group']
                    || userInfo?.['user.GroupName']
                    || userInfo?.['user.UserGroup']
                    || userInfo?.['user.group']
                    || '',
                ).trim()

                const normalizeAuthorities = (input) => {
                    if (Array.isArray(input)) {
                        return input.map((value) => String(value || '').trim()).filter(Boolean)
                    }
                    if (typeof input === 'string') {
                        return input.split(/[;,]/).map((value) => value.trim()).filter(Boolean)
                    }
                    return []
                }

                // Handle flattened structure: 'user.AuthorityList[0]', 'user.AuthorityList[1]', etc.
                const extractFlattenedAuthorities = (obj) => {
                    const result = []
                    if (!obj || typeof obj !== 'object') return result
                    
                    const keys = Object.keys(obj)
                    const authorityKeys = keys
                        .filter(key => key.includes('AuthorityList['))
                        .sort((a, b) => {
                            const indexA = parseInt(a.match(/\[(\d+)\]/)?.[1] || '0')
                            const indexB = parseInt(b.match(/\[(\d+)\]/)?.[1] || '0')
                            return indexA - indexB
                        })
                    
                    authorityKeys.forEach(key => {
                        const value = String(obj[key] || '').trim()
                        if (value) result.push(value)
                    })
                    
                    return result
                }

                const authorities = [
                    ...extractFlattenedAuthorities(userInfo),
                    ...normalizeAuthorities(userInfo?.AuthorityList),
                    ...normalizeAuthorities(userInfo?.authorities || userInfo?.Authorities),
                ]

                if (groupName) {
                    try {
                        const groupInfo = await permissionService.getGroupInfo(groupName)
                        authorities.push(
                            ...extractFlattenedAuthorities(groupInfo),
                            ...normalizeAuthorities(groupInfo?.AuthorityList),
                            ...normalizeAuthorities(groupInfo?.authorities || groupInfo?.Authorities),
                        )
                    } catch (err) {
                        // Fallback to user authorities if group lookup is unavailable.
                    }
                }

                const mergedAuthorities = Array.from(
                    new Set(authorities.filter(Boolean)),
                )

                if (mergedAuthorities.length > 0 || groupName) {
                    authStore.actions.setSession({
                        username: sessionPayload.username,
                        digestSecret: loginResult?.digestSecret || null,
                        challenge: loginResult?.challenge || null,
                        rtspPassword: password,
                        authorities: mergedAuthorities,
                        groupName,
                    })
                }
            } catch (err) {
                // Non-fatal: if fetching authorities fails, continue without blocking login
            }

            if (rememberMe) {
                localStorage.setItem(REMEMBER_KEY, username)
            } else {
                localStorage.removeItem(REMEMBER_KEY)
            }

            // Start idle monitoring after successful login
            startIdleMonitoring(() => {
                clearSession()
                navigate('/login', { replace: true })
            })

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
