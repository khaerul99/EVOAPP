import { useCallback, useEffect, useState } from 'react';
import { permissionService } from '../../services/user/permission.service';
import { warmupDigestChallenge } from '../../services/auth/digest-warmup.service';
import { authStore } from '../../stores/authSlice';
import { loginWithDigest } from '../../services/auth/auth.service';
import { cameraService } from '../../services/camera/camera.service';

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
const PERMISSION_TO_AUTHORITY_TOKEN = {
    System: 'AuthSysCfg',
    Event: 'AuthEventCfg',
    Account: 'AuthUserMag',
    Storage: 'AuthStoreCfg',
    Network: 'AuthNetCfg',
    Security: 'AuthSecurity',
    Camera: 'AuthRmtDevice',
    Peripheral: 'AuthPeripheral',
    PTZ: 'AuthPTZ',
    Backup: 'AuthBackup',
    Maintenance: 'Device Maintenance',
    Tasks: 'AuthTaskMag',
    'Manual Control': 'AuthManuCtr',
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
        // Keep this only for authority-like containers.
        const keyTail = normalizedKey.split('.').pop() || normalizedKey;
        const keyTailWithoutIndex = keyTail.replace(/\[\d+\]$/g, '');
        const permissionFromKey = canonicalizePermissionName(keyTailWithoutIndex);
        if (permissionFromKey && /authorit/i.test(normalizedKey) && isTruthyValue(normalizedValue)) {
            authorities.push(permissionFromKey);
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

export function usePermissionManagement(userName, groupName = '', authoritiesOverride = []) {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [channels, setChannels] = useState([]);

    // Initialize permission state with defaults
    const [permissionState, setPermissionState] = useState(initializeDefaultPermissionState());
    const [draftPermissionState, setDraftPermissionState] = useState(initializeDefaultPermissionState());
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState('');
    const [saveSuccessMessage, setSaveSuccessMessage] = useState('');
    const [canEdit, setCanEdit] = useState(false);

    const currentUsername = String(authStore.getState()?.auth?.username || '').trim();

    const detectOwnerFromPayload = useCallback((payload = {}) => {
        const ownerKeys = [
            'Creator',
            'creator',
            'CreateBy',
            'createBy',
            'Owner',
            'owner',
            'ManagerName',
            'managerName',
        ];

        for (const key of ownerKeys) {
            const value = String(payload?.[key] || '').trim();
            if (value) {
                return value;
            }
        }

        for (const [key, value] of Object.entries(payload || {})) {
            if (!/(creator|createby|owner|managername)/i.test(String(key))) {
                continue;
            }
            const text = String(value || '').trim();
            if (text) {
                return text;
            }
        }

        return '';
    }, []);

    const isOwnershipDeniedError = useCallback((errorLike) => {
        const text = String(
            (errorLike?.response && (typeof errorLike.response.data === 'string' ? errorLike.response.data : errorLike.response.data?.message))
            || errorLike?.message
            || errorLike
            || '',
        ).toLowerCase();

        return text.includes('not owner')
            || text.includes('not creator')
            || text.includes('no permission')
            || text.includes('permission denied')
            || text.includes('not authorized')
            || text.includes('auth failed');
    }, []);

    const loadPermissionData = useCallback(async () => {
        const hasOverride = Array.isArray(authoritiesOverride) && authoritiesOverride.length > 0;
        const hasUserTarget = Boolean(String(userName || '').trim());
        const hasGroupTarget = Boolean(String(groupName || '').trim());
        if (!hasUserTarget && !hasGroupTarget && !hasOverride) {
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            setError('');

            // Ensure digest challenge is warmed up so first feature request is less likely to fail with 401.
            await warmupDigestChallenge().catch(() => {});

            // Keep channel source consistent with Add Group flow.
            const channelRows = await cameraService.getCameraChannels().catch(() => []);

            // Get user info (skip if permission is provided from selected group)
            const shouldUseAuthorityOverride = hasOverride;
            let targetInfo = null;
            let userInfo = null;

            if (shouldUseAuthorityOverride) {
                targetInfo = null;
            } else if (hasUserTarget) {
                // User permission follows the group where the user belongs.
                userInfo = await permissionService.getUserInfo(userName);
                const detectedGroupName = String(
                    userInfo?.group
                    || userInfo?.Group
                    || userInfo?.GroupName
                    || userInfo?.groupName
                    || '',
                ).trim();

                if (detectedGroupName) {
                    try {
                        targetInfo = await permissionService.getGroupInfo(detectedGroupName);
                    } catch {
                        targetInfo = userInfo;
                    }
                } else {
                    targetInfo = userInfo;
                }
            } else {
                targetInfo = await permissionService.getGroupInfo(groupName);
            }

            // Initialize permission state based on authorities
            const authorities = shouldUseAuthorityOverride
                ? authoritiesOverride
                    .map((entry) => mapAuthorityToken(entry))
                    .filter(Boolean)
                : extractAuthorities(targetInfo);
            const authoritySet = toAuthoritySet(authorities);
            const newPermissionState = {};
            // Process authorities for config/operation/control
            Object.entries(PERMISSION_CATEGORIES).forEach(([category, data]) => {
                newPermissionState[category] = {};
                data.permissions.forEach(permission => {
                    newPermissionState[category][permission] = hasPermissionAuthority(authoritySet, permission);
                });
            });

            // Process channel permissions
            const channelList = (Array.isArray(channelRows) ? channelRows : [])
                .map((row) => ({
                    id: Number(row?.id),
                    name: String(row?.name || row?.channelName || `Channel ${row?.id}`),
                }))
                .filter((channel) => Number.isFinite(channel.id) && channel.id > 0)
                .sort((left, right) => left.id - right.id);

            channelList.forEach((channel) => {
                newPermissionState[`channel_${channel.id}`] = {};
                CHANNEL_ACTIONS.forEach((action) => {
                    const authKey = `${action}Channel${channel.id}`;
                    newPermissionState[`channel_${channel.id}`][action] = authoritySet.has(normalizeAuthorityToken(authKey));
                });
            });

            setChannels(channelList);
            setPermissionState(newPermissionState);
            setDraftPermissionState(newPermissionState);

            const ownerName = detectOwnerFromPayload(targetInfo || {});
            const normalizedCurrentUser = normalizeAuthorityToken(currentUsername);
            const normalizedOwner = normalizeAuthorityToken(ownerName);
            const normalizedTargetUser = normalizeAuthorityToken(userName);

            const isOwnerMatch = Boolean(normalizedOwner) && normalizedOwner === normalizedCurrentUser;
            const isEditingSelfUser = Boolean(normalizedTargetUser) && normalizedTargetUser === normalizedCurrentUser;
            const protectedNames = new Set(['admin', 'administrator', 'onvif', 'evosecure']);
            const normalizedGroupTarget = normalizeAuthorityToken(groupName);
            const isProtectedTarget = protectedNames.has(normalizedTargetUser) || protectedNames.has(normalizedGroupTarget);
            const canFallbackEdit = !normalizedOwner && !isProtectedTarget;
            const nextCanEdit = hasUserTarget
                ? false
                : (isOwnerMatch || isEditingSelfUser || canFallbackEdit);

            setCanEdit(nextCanEdit);
            if (!nextCanEdit) {
            }
        } catch (err) {
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
            setDraftPermissionState(initializeDefaultPermissionState());
            setCanEdit(false);
        } finally {
            setLoading(false);
        }
    }, [authoritiesOverride, currentUsername, detectOwnerFromPayload, groupName, userName]);

    const togglePermission = useCallback((sectionKey, permissionName, checked) => {
        setDraftPermissionState((previous) => ({
            ...previous,
            [sectionKey]: {
                ...(previous?.[sectionKey] || {}),
                [permissionName]: Boolean(checked),
            },
        }));
    }, []);

    const toggleSectionPermissions = useCallback((sectionKey, checked) => {
        const section = PERMISSION_CATEGORIES?.[sectionKey];
        if (!section) {
            return;
        }

        setDraftPermissionState((previous) => {
            const nextSectionState = { ...(previous?.[sectionKey] || {}) };
            section.permissions.forEach((permissionName) => {
                nextSectionState[permissionName] = Boolean(checked);
            });

            return {
                ...previous,
                [sectionKey]: nextSectionState,
            };
        });
    }, []);

    const toggleChannelPermission = useCallback((channelId, action, checked) => {
        const channelKey = `channel_${channelId}`;
        setDraftPermissionState((previous) => ({
            ...previous,
            [channelKey]: {
                ...(previous?.[channelKey] || {}),
                [action]: Boolean(checked),
            },
        }));
    }, []);

    const toggleAllChannelPermissions = useCallback((channelIds, checked) => {
        const ids = Array.isArray(channelIds) ? channelIds : [];
        setDraftPermissionState((previous) => {
            const nextState = { ...previous };
            ids.forEach((channelId) => {
                const channelKey = `channel_${channelId}`;
                nextState[channelKey] = {
                    ...(previous?.[channelKey] || {}),
                    Live: Boolean(checked),
                    Playback: Boolean(checked),
                };
            });
            return nextState;
        });
    }, []);

    const buildAuthorityPayloadFromDraft = useCallback(() => {
        const tokens = [];
        const isAdminGroup = String(groupName || '').trim().toLowerCase() === 'admin';

        Object.entries(PERMISSION_CATEGORIES).forEach(([category, data]) => {
            data.permissions.forEach((permissionName) => {
                if (!draftPermissionState?.[category]?.[permissionName]) {
                    return;
                }
                if (permissionName === 'Account' && !isAdminGroup) {
                    return;
                }
                const token = PERMISSION_TO_AUTHORITY_TOKEN[permissionName];
                if (token) {
                    tokens.push(token);
                }
            });
        });

        channels.forEach((channel) => {
            const channelKey = `channel_${channel.id}`;
            if (draftPermissionState?.[channelKey]?.Live) {
                tokens.push(`LiveChannel${channel.id}`);
            }
            if (draftPermissionState?.[channelKey]?.Playback) {
                tokens.push(`PlaybackChannel${channel.id}`);
            }
        });

        return Array.from(new Set(tokens));
    }, [channels, draftPermissionState]);

    const applyPermissionChanges = useCallback(async (authPassword) => {
        const password = String(authPassword || '').trim();
        if (!password) {
            throw new Error('Password autentikasi wajib diisi.');
        }

        const authorities = buildAuthorityPayloadFromDraft();
        const managerName = String(authStore.getState()?.auth?.username || '').trim();

        setSaving(true);
        setSaveError('');
        setSaveSuccessMessage('');
        try {
            const probe = await loginWithDigest(managerName, password);
            if (probe && probe.requiresDigest === false) {
                throw new Error('Perangkat tidak dapat memverifikasi kredensial melalui endpoint probe.');
            }

            const hasUserTarget = Boolean(String(userName || '').trim());
            const hasGroupTarget = Boolean(String(groupName || '').trim());
            let saved = false;

            if (hasUserTarget) {
                saved = await permissionService.modifyUserPermissions(userName, authorities, {
                    managerName,
                    managerPwd: password,
                });
            } else if (hasGroupTarget) {
                saved = await permissionService.modifyGroupPermissions(groupName, authorities, {
                    managerName,
                    managerPwd: password,
                });
            } else {
                throw new Error('Target permission tidak ditemukan.');
            }

            if (!saved) {
                throw new Error('Perubahan permission ditolak perangkat.');
            }

            setSaveSuccessMessage('Permission berhasil diperbarui.');
            await loadPermissionData();
            return true;
        } catch (err) {
            const message =
                (err?.response && (typeof err.response.data === 'string' ? err.response.data : err.response.data?.message))
                || err?.message
                || 'Gagal menyimpan permission.';
            setSaveError(String(message));
            if (isOwnershipDeniedError(err) || isOwnershipDeniedError(message)) {
                setCanEdit(false);
            }
            throw new Error(String(message));
        } finally {
            setSaving(false);
        }
    }, [buildAuthorityPayloadFromDraft, currentUsername, groupName, isOwnershipDeniedError, loadPermissionData, userName]);

    const hasUnsavedChanges = JSON.stringify(draftPermissionState) !== JSON.stringify(permissionState);

    useEffect(() => {
        loadPermissionData();
    }, [loadPermissionData]);

    return {
        loading,
        error,
        permissionState,
        draftPermissionState,
        channels,
        saving,
        saveError,
        saveSuccessMessage,
        canEdit,
        hasUnsavedChanges,
        PERMISSION_CATEGORIES,
        togglePermission,
        toggleSectionPermissions,
        toggleChannelPermission,
        toggleAllChannelPermissions,
        applyPermissionChanges,
        setSaveError,
        loadPermissionData,
    };
}
