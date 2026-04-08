import React from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'

const SESSION_KEY = 'evosecure_session'

const ProtectedRoute = () => {
    const location = useLocation()
    const isAuthenticated = Boolean(localStorage.getItem(SESSION_KEY))

    if (!isAuthenticated) {
        return <Navigate to="/login" replace state={{ from: location }} />
    }

    return <Outlet />
}

export default ProtectedRoute
