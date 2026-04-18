import { useCallback, useEffect, useState } from 'react';
import { permissionService } from '../../services/user/permission.service';
import { warmupDigestChallenge } from '../../services/auth/digest-warmup.service';

const PERMISSION_CATEGORIES = {
    config: {
        label: 'Config',
        permissions: ['System', 'Event', 'Account', 'Storage', 'Network', 'Security', 'Camera', 'Peripheral', 'PTZ'],
    },
    operation: {
        label: 'Operation',
        permissions: ['Backup', 'Maintenance', 'Device Maintenance', 'Tasks'],
    },
    control: {
        label: 'Control',
        permissions: ['Manual Control'],
    },
};

const CHANNEL_ACTIONS = ['Live', 'Playback'];
const ALL_PERMISSION_NAMES = Object.values(PERMISSION_CATEGORIES).flatMap((item) => item.permissions);
const AUTHORITY_TOKEN_MAP = {
    authsyscfg: 'System',
    autheventcfg: 'Event',
    authusermag: 'Account',
    authstorecfg: 'Storage',
    authnetcfg: 'Network',
    authsecurity: 'Security',
    authrmtdevice: 'Camera',
    authperipheral: 'Peripheral',
    authptz: 'PTZ',
    authbackup: 'Backup',
    authmaintence: 'Maintenance',
    authmaintenance: 'Maintenance',
    authtaskmag: 'Tasks',
    authmanuctr: 'Manual Control',
};

const normalizeAuthorityToken = (value) => String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '');

const isTruthyValue = (value) => {
    const normalized = String(value || '').trim().toLowerCase();
    return normalized === '1'
        || normalized === 'true'
        || normalized === 'on'
        || normalized === 'yes'
        || normalized === 'enable'
        || normalized === 'enabled';
};

const canonicalizePermissionName = (token) => {
    const normalizedToken = normalizeAuthorityToken(token);
    const matched = ALL_PERMISSION_NAMES.find((name) => normalizeAuthorityToken(name) === normalizedToken);
    return matched || null;
};

const collectFlattenedEntries = (input, prefix = '', output = []) => {
    if (input === null || input === undefined) {
        return output;
    }

    if (Array.isArray(input)) {
        input.forEach((item, index) => {
            const nextPrefix = prefix ? `${prefix}[${index}]` : `[${index}]`;
            collectFlattenedEntries(item, nextPrefix, output);
        });
        return output;
    }

    if (typeof input === 'object') {
        Object.entries(input).forEach(([key, value]) => {
            const nextPrefix = prefix ? `${prefix}.${key}` : key;
            collectFlattenedEntries(value, nextPrefix, output);
        });
        return output;
    }

    output.push({ key: prefix, value: String(input) });
    return output;
};

const toStringFragments = (value) => {
    if (value === null || value === undefined) {
        return [];
    }

    if (Array.isArray(value)) {
        return value.flatMap((entry) => toStringFragments(entry));
    }

    if (typeof value === 'object') {
        return Object.values(value).flatMap((entry) => toStringFragments(entry));
    }

    const text = String(value).trim();
    return text ? [text] : [];
};

const mapAuthorityToken = (token) => {
    const raw = String(token || '').trim();
    if (!raw) {
        return null;
    }

    const monitorMatch = raw.match(/^monitor[_\- ]?(\d+)$/i);
    if (monitorMatch) {
        return `LiveChannel${Number(monitorMatch[1])}`;
    }

    const replayMatch = raw.match(/^replay[_\- ]?(\d+)$/i);
    if (replayMatch) {
        return `PlaybackChannel${Number(replayMatch[1])}`;
    }

    const normalized = normalizeAuthorityToken(raw);
    if (AUTHORITY_TOKEN_MAP[normalized]) {
        return AUTHORITY_TOKEN_MAP[normalized];
    }

    const canonical = canonicalizePermissionName(raw);
    return canonical || null;
};

const extractAuthorities = (userInfo) => {
    const directCandidates = [
        userInfo?.authorities,
        userInfo?.Authorities,
        userInfo?.AuthorityList,
        userInfo?.authorityList,
        userInfo?.authority,
        userInfo?.Authority,
    ];

    const authorities = [];

    directCandidates.forEach((candidate) => {
        toStringFragments(candidate).forEach((fragment) => {
            fragment
                .split(/[;,]/)
                .map((entry) => entry.trim())
                .filter(Boolean)
                .forEach((entry) => {
                    const mapped = mapAuthorityToken(entry);
                    if (mapped) {
                        authorities.push(mapped);
                    }
                });
        });
    });

    Object.entries(userInfo || {}).forEach(([key, value]) => {
        const normalizedKey = String(key || '').trim();
        const valueFragments = toStringFragments(value);
        const normalizedValue = valueFragments.join(',').trim();

        // Pattern A: keys contain authority list, values are permission names.
        if (/authorit/i.test(normalizedKey)) {
            valueFragments.forEach((fragment) => {
                fragment
                    .split(/[;,]/)
                    .map((entry) => entry.trim())
                    .filter(Boolean)
                    .forEach((entry) => {
                        
                        if (/^(0|1|true|false)$/i.test(entry)) {
                            return;
                        }
                        const mapped = mapAuthorityToken(entry);
                        if (mapped) {
                            authorities.push(mapped);
                        }
                    });
            });
        }

        // Pattern B: key itself is permission name and value is true/1.
        const keyTail = normalizedKey.split('.').pop() || normalizedKey;
        const keyTailWithoutIndex = keyTail.replace(/\[\d+\]$/g, '');
        const permissionFromKey = canonicalizePermissionName(keyTailWithoutIndex);
        if (permissionFromKey && isTruthyValue(normalizedValue)) {
            authorities.push(permissionFromKey);
        }

        // Pattern C: key contains channel permission token and value true/1.
        const liveChannelMatch = normalizedKey.match(/live\s*channel\s*(\d+)/i);
        if (liveChannelMatch && isTruthyValue(normalizedValue)) {
            authorities.push(`LiveChannel${liveChannelMatch[1]}`);
        }

        const playbackChannelMatch = normalizedKey.match(/playback\s*channel\s*(\d+)/i);
        if (playbackChannelMatch && isTruthyValue(normalizedValue)) {
            authorities.push(`PlaybackChannel${playbackChannelMatch[1]}`);
        }

        // Pattern D: value contains channel permission token directly.
        const channelTokenMatch = normalizedValue.match(/(live|playback)\s*channel\s*(\d+)/ig);
        if (channelTokenMatch) {
            channelTokenMatch.forEach((entry) => {
                const match = entry.match(/(live|playback)\s*channel\s*(\d+)/i);
                if (!match) {
                    return;
                }
                const action = match[1].toLowerCase() === 'live' ? 'Live' : 'Playback';
                authorities.push(`${action}Channel${match[2]}`);
            });
        }
    });

    // Pattern E: recursively inspect nested payloads but only for authority-like keys.
    const flattened = collectFlattenedEntries(userInfo);
    flattened.forEach(({ key, value }) => {
        const normalizedKey = String(key || '').trim();
        if (!/authorit/i.test(normalizedKey)) {
            return;
        }

        toStringFragments(value)
            .flatMap((fragment) => fragment.split(/[;,]/).map((entry) => entry.trim()).filter(Boolean))
            .forEach((entry) => {
                const mapped = mapAuthorityToken(entry);
                if (mapped) {
                    authorities.push(mapped);
                }
            });
    });

    return Array.from(new Set(authorities));
};

const toAuthoritySet = (authorities) => {
    const set = new Set();
    authorities.forEach((item) => {
        set.add(normalizeAuthorityToken(item));
    });
    return set;
};

const extractChannelIdsFromAuthorities = (authorities) => {
    const channelIds = new Set();
    authorities.forEach((authority) => {
        const match = String(authority || '').match(/(?:live|playback)channel(\d+)/i);
        if (match) {
            channelIds.add(Number(match[1]));
        }
    });
    return channelIds;
};

const hasPermissionAuthority = (authoritySet, permissionName) => {
    const normalized = normalizeAuthorityToken(permissionName);
    if (authoritySet.has(normalized)) {
        return true;
    }

    // Device firmware exposes a single token (AuthMaintence) for both
    // Maintenance and Device Maintenance in the dashboard UI.
    if (normalized === normalizeAuthorityToken('Device Maintenance')) {
        return authoritySet.has(normalizeAuthorityToken('Maintenance'));
    }

    return false;
};

// Initialize default permission state
const initializeDefaultPermissionState = () => {
    const state = {};
    
    Object.entries(PERMISSION_CATEGORIES).forEach(([category, data]) => {
        state[category] = {};
        data.permissions.forEach(permission => {
            state[category][permission] = false;
        });
    });
    
    return state;
};

export function usePermissionManagement(userName) {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [channels, setChannels] = useState([]);

    // Initialize permission state with defaults
    const [permissionState, setPermissionState] = useState(initializeDefaultPermissionState());

    const loadPermissionData = useCallback(async () => {
        if (!userName) {
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            setError('');

            // Ensure digest challenge is warmed up so first feature request is less likely to fail with 401.
            await warmupDigestChallenge().catch(() => {});

            // Get abilities
            const abilitiesData = await permissionService.getAbility();

            // Get active channel IDs from device config
            const activeChannelIds = await permissionService.getActiveChannelIds();

            // Get user info
            const userInfo = await permissionService.getUserInfo(userName);

            // Initialize permission state based on authorities
            const authorities = extractAuthorities(userInfo);
            const authoritySet = toAuthoritySet(authorities);
            const newPermissionState = {};
            const normalizedGroup = normalizeAuthorityToken(
                userInfo?.group
                || userInfo?.Group
                || userInfo?.GroupName
                || userInfo?.groupName,
            );
            const normalizedUserName = normalizeAuthorityToken(
                userInfo?.name
                || userInfo?.Name
                || userInfo?.UserName
                || userName,
            );
            const useAdminFallback = authorities.length === 0 && (
                normalizedGroup === 'admin'
                || normalizedGroup === 'administrator'
                || normalizedUserName === 'admin'
            );

            // Process authorities for config/operation/control
            Object.entries(PERMISSION_CATEGORIES).forEach(([category, data]) => {
                newPermissionState[category] = {};
                data.permissions.forEach(permission => {
                    newPermissionState[category][permission] = useAdminFallback
                        ? true
                        : hasPermissionAuthority(authoritySet, permission);
                });
            });

            // Process channel permissions
            const authorityChannelIds = extractChannelIdsFromAuthorities(authorities);
            const channelList = [];
            Object.entries(abilitiesData).forEach(([key, value]) => {
                const match = key.match(/^Channel(\d+)$/);
                if (match && value) {
                    const channelNum = parseInt(match[1]);
                    if (activeChannelIds.size > 0 && !activeChannelIds.has(channelNum)) {
                        return;
                    }

                    if (authorityChannelIds.size > 0 && !authorityChannelIds.has(channelNum)) {
                        return;
                    }

                    const channelName = value;
                    channelList.push({
                        id: channelNum,
                        name: channelName,
                    });
                    
                    newPermissionState[`channel_${channelNum}`] = {};
                    CHANNEL_ACTIONS.forEach(action => {
                        const authKey = `${action}Channel${channelNum}`;
                        newPermissionState[`channel_${channelNum}`][action] = useAdminFallback
                            ? true
                            : authoritySet.has(normalizeAuthorityToken(authKey));
                    });
                }
            });

            setChannels(channelList);
            setPermissionState(newPermissionState);
        } catch (err) {
            console.error('Failed to load permission data:', err);
            let errorMessage = 'Gagal memuat data permission dari perangkat.';
            
            if (err?.response?.status === 501) {
                errorMessage = 'Endpoint tidak tersedia di perangkat. Pastikan userManager API terpasang.';
            } else if (err?.response?.status === 401) {
                errorMessage = 'Session autentikasi tidak valid. Silakan login ulang lalu coba lagi.';
            } else if (err?.response?.data) {
                errorMessage = `Error: ${err.response.data}`;
            } else if (err?.message) {
                errorMessage = `Error: ${err.message}`;
            }
            
            setError(errorMessage);
            setPermissionState(initializeDefaultPermissionState());
        } finally {
            setLoading(false);
        }
    }, [userName]);

    useEffect(() => {
        loadPermissionData();
    }, [loadPermissionData]);

    return {
        loading,
        error,
        permissionState,
        channels,
        PERMISSION_CATEGORIES,
        loadPermissionData,
    };
}
