import React, { useEffect, useState } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { hasSession, startIdleMonitoring, stopIdleMonitoring, clearSession } from '../../lib/session-helper'

const SESSION_RECHECK_INTERVAL_MS = 60 * 1000

const ProtectedRoute = () => {
    const location = useLocation()
    const [isAuthenticated, setIsAuthenticated] = useState(() => hasSession())

    useEffect(() => {
        setIsAuthenticated(hasSession())

        const handleIdleExpired = () => {
            console.warn('Session expired due to inactivity (30 min idle)')
            clearSession()
            setIsAuthenticated(false)
        }

        if (hasSession()) {
            startIdleMonitoring(handleIdleExpired)
        } else {
            stopIdleMonitoring()
        }

        const intervalId = window.setInterval(() => {
            if (hasSession()) {
                setIsAuthenticated(true)
                if (!isAuthenticated) {
                    startIdleMonitoring(handleIdleExpired)
                }
            } else {
                stopIdleMonitoring()
                setIsAuthenticated(false)
            }
        }, SESSION_RECHECK_INTERVAL_MS)

        return () => {
            window.clearInterval(intervalId)
            stopIdleMonitoring()
        }
    }, [location.pathname, isAuthenticated])

    if (!isAuthenticated) {
        return <Navigate to="/login" replace state={{ from: location }} />
    }

    return <Outlet />
}

export default ProtectedRoute
