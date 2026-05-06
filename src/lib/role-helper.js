function normalizeToken(value) {
    return String(value || '').trim().toLowerCase()
}

function getAuthorities(stateOrAuthorities = []) {
    return Array.isArray(stateOrAuthorities)
        ? stateOrAuthorities
        : (Array.isArray(stateOrAuthorities?.authorities) ? stateOrAuthorities.authorities : [])
}

export function hasAdminAccess(stateOrAuthorities = []) {
    const username = normalizeToken(stateOrAuthorities?.auth?.username || stateOrAuthorities?.username)
    const groupName = normalizeToken(
        stateOrAuthorities?.auth?.groupName
        || stateOrAuthorities?.auth?.group
        || stateOrAuthorities?.groupName
        || stateOrAuthorities?.group
        || stateOrAuthorities?.auth?.GroupName
        || stateOrAuthorities?.auth?.UserGroup
    )
    const authorities = getAuthorities(stateOrAuthorities)

    if (username === 'admin' || username === 'administrator' || groupName === 'admin' || groupName === 'administrator') {
        return true
    }

    return authorities.some((authority) => {
        const token = normalizeToken(authority)
        return token === 'authusermag'
            || token === 'admin'
            || token === 'administrator'
            || token.includes('admin')
    })
}

export function getRoleLabel(stateOrAuthorities = []) {
    return hasAdminAccess(stateOrAuthorities) ? 'Admin' : 'User'
}

export function hasAuthority(stateOrAuthorities = [], token) {
    try {
        if (!token) return false
        const desired = String(token || '').trim().toLowerCase()
        const authorities = getAuthorities(stateOrAuthorities)

        return authorities.some((a) => String(a || '').trim().toLowerCase() === desired || String(a || '').trim().toLowerCase().includes(desired))
    } catch {
        return false
    }
}

export function hasAnyAuthority(stateOrAuthorities = [], tokens = []) {
    const list = Array.isArray(tokens) ? tokens : []
    if (list.length === 0) return false
    return list.some((token) => hasAuthority(stateOrAuthorities, token))
}

export function hasAuthorityPrefix(stateOrAuthorities = [], prefix = '') {
    try {
        const desiredPrefix = normalizeToken(prefix)
        if (!desiredPrefix) return false
        const authorities = getAuthorities(stateOrAuthorities)
        return authorities.some((authority) => normalizeToken(authority).startsWith(desiredPrefix))
    } catch {
        return false
    }
}