import React from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useStore } from '../../stores/useStore'

const ProtectedRoute = () => {
    const isAuthenticated = useStore((state) => state.isAuthenticated)
    const location = useLocation()

    if (!isAuthenticated) {
        return <Navigate to="/login" replace state={{ from: location }} />
    }

    return <Outlet />
}

export default ProtectedRoute
