import React, { useEffect, useState } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { hasSession } from '../../lib/session-helper'

const SESSION_RECHECK_INTERVAL_MS = 60 * 1000

const ProtectedRoute = () => {
    const location = useLocation()
    const [isAuthenticated, setIsAuthenticated] = useState(() => hasSession())

    useEffect(() => {
        setIsAuthenticated(hasSession())

        const intervalId = window.setInterval(() => {
            setIsAuthenticated(hasSession())
        }, SESSION_RECHECK_INTERVAL_MS)

        return () => {
            window.clearInterval(intervalId)
        }
    }, [location.pathname])

    if (!isAuthenticated) {
        return <Navigate to="/login" replace state={{ from: location }} />
    }

    return <Outlet />
}

export default ProtectedRoute
