import React from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { hasSession } from '../../lib/session-helper'

const ProtectedRoute = () => {
    const location = useLocation()
    const isAuthenticated = hasSession()

    if (!isAuthenticated) {
        return <Navigate to="/login" replace state={{ from: location }} />
    }

    return <Outlet />
}

export default ProtectedRoute
