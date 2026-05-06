import React from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '../../stores/authSlice'
import { hasAdminAccess, hasAnyAuthority, hasAuthority, hasAuthorityPrefix } from '../../lib/role-helper'

const RoleRoute = ({
    requireAdmin = false,
    requiredPermission = '',
    requiredAnyPermissions = [],
    requiredPrefix = '',
    children,
}) => {
    const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
    const auth = useAuthStore((state) => state.auth)
    const authorities = useAuthStore((state) => state.authorities)
    const authState = { auth, authorities }

    if (!isAuthenticated) {
        return <Navigate to="/login" replace />
    }

    const isAdmin = hasAdminAccess(authState)

    // If specific permission is required, allow if admin OR has that authority.
    if (requiredPermission && !isAdmin && !hasAuthority(authState, requiredPermission)) {
        return <Navigate to="/dashboard" replace />
    }

    // If any permission from the list is required.
    if (Array.isArray(requiredAnyPermissions) && requiredAnyPermissions.length > 0 && !isAdmin && !hasAnyAuthority(authState, requiredAnyPermissions)) {
        return <Navigate to="/dashboard" replace />
    }

    // If a token prefix is required (e.g. Monitor_, Replay_).
    if (requiredPrefix && !isAdmin && !hasAuthorityPrefix(authState, requiredPrefix)) {
        return <Navigate to="/dashboard" replace />
    } else if (requireAdmin) {
        if (!isAdmin) {
            return <Navigate to="/dashboard" replace />
        }
    }

    return children || <Outlet />
}

export default RoleRoute