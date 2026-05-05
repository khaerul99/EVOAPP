import ApiClient from '../../lib/api';

class PermissionService {
    toLegacyAuthorityToken(token) {
        const raw = String(token || '').trim();
        if (!raw) {
            return '';
        }

        const liveMatch = raw.match(/^LiveChannel(\d+)$/i);
        if (liveMatch) {
            return `Monitor_${String(Number(liveMatch[1])).padStart(2, '0')}`;
        }

        const playbackMatch = raw.match(/^PlaybackChannel(\d+)$/i);
        if (playbackMatch) {
            return `Replay_${String(Number(playbackMatch[1])).padStart(2, '0')}`;
        }

        return raw;
    }

    buildAuthorityVariants(authorities = []) {
        const normalized = Array.from(new Set(
            (Array.isArray(authorities) ? authorities : [])
                .map((entry) => String(entry || '').trim())
                .filter(Boolean),
        ));

        const legacy = normalized
            .map((entry) => this.toLegacyAuthorityToken(entry))
            .filter(Boolean);

        return [
            normalized,
            Array.from(new Set(legacy)),
        ].filter((list) => list.length > 0);
    }

    parseKeyValuePayload(data) {
        if (typeof data !== 'string') {
            return data && typeof data === 'object' ? data : {};
        }

        const output = {};
        const duplicateKeys = {};
        data
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter(Boolean)
            .forEach((line) => {
                const separatorIndex = line.indexOf('=');
                if (separatorIndex < 0) {
                    return;
                }
                const key = line.slice(0, separatorIndex).trim();
                const value = line.slice(separatorIndex + 1).trim();
                if (!key) {
                    return;
                }

                if (Object.prototype.hasOwnProperty.call(output, key)) {
                    if (!Array.isArray(output[key])) {
                        output[key] = [output[key]];
                    }
                    output[key].push(value);
                    duplicateKeys[key] = true;
                    return;
                }

                output[key] = value;
            });

        if (Object.keys(duplicateKeys).length > 0) {
            output.__metaDuplicateKeys = Object.keys(duplicateKeys);
        }

        return output;
    }

    isActionNotSupported(error) {
        const status = error?.response?.status;
        const body = String(error?.response?.data || '').toLowerCase();
        return status === 501 || status === 404 || body.includes('not implemented') || body.includes('not support');
    }

    isTruthyConfigValue(value) {
        const normalizedValue = String(value || '').trim().toLowerCase();
        return normalizedValue === 'true'
            || normalizedValue === '1'
            || normalizedValue === 'on'
            || normalizedValue === 'yes'
            || normalizedValue === 'enable'
            || normalizedValue === 'enabled';
    }

    toNumber(value) {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : null;
    }

    resolveRemoteChannelIndex(device = {}, objectId = '') {
        const candidates = [
            this.toNumber(device['assignLocalChannel[0]']),
            this.toNumber(device.assignLocalChannel),
            this.toNumber(device.LogicChannelStart),
            this.toNumber(device['Channels[0].channel']),
            this.toNumber(device['Channels[0].uniqueChannel']),
        ].filter((value) => value !== null && value >= 0);

        if (candidates.length > 0) {
            return candidates[0];
        }

        const match = String(objectId || '').match(/(\d+)$/);
        if (!match) {
            return null;
        }

        const sequence = this.toNumber(match[1]);
        if (sequence !== null && sequence > 0) {
            return sequence - 1;
        }

        return null;
    }

    parseActiveChannelIds(remoteParsed = {}) {
        const groupedByDevice = {};

        Object.entries(remoteParsed).forEach(([key, value]) => {
            const indexedMatch = key.match(/^table\.RemoteDevice\[(\d+)\]\.(.+)$/i);
            if (indexedMatch) {
                const index = Number(indexedMatch[1]);
                const field = String(indexedMatch[2] || '').trim();
                const objectId = `indexed_${String(index).padStart(6, '0')}`;
                if (!groupedByDevice[objectId]) {
                    groupedByDevice[objectId] = { objectId, _index: index };
                }
                groupedByDevice[objectId][field] = value;
                return;
            }

            const objectMatch = key.match(/^table\.RemoteDevice\.([^.]+)\.(.+)$/i);
            if (objectMatch) {
                const objectId = String(objectMatch[1] || '').trim();
                const field = String(objectMatch[2] || '').trim();
                if (!objectId || !field) {
                    return;
                }

                if (!groupedByDevice[objectId]) {
                    groupedByDevice[objectId] = { objectId, _index: null };
                }
                groupedByDevice[objectId][field] = value;
            }
        });

        const enabledChannels = new Set();
        Object.values(groupedByDevice).forEach((device) => {
            const enabled = this.isTruthyConfigValue(device.Enable ?? device.enable ?? device.Enabled);
            if (!enabled) {
                return;
            }

            let channelIndex = this.resolveRemoteChannelIndex(device, device.objectId);
            if (channelIndex === null && Number.isFinite(device._index) && device._index >= 0) {
                channelIndex = device._index;
            }

            if (channelIndex === null) {
                return;
            }

            enabledChannels.add(channelIndex + 1);
        });

        return enabledChannels;
    }

    async getActiveChannelIds() {
        try {
            const remoteDeviceResponse = await ApiClient.get('/cgi-bin/configManager.cgi', {
                params: {
                    action: 'getConfig',
                    name: 'RemoteDevice',
                },
            });

            const remoteParsed = this.parseKeyValuePayload(remoteDeviceResponse?.data);
            return this.parseActiveChannelIds(remoteParsed);
        } catch {
            return new Set();
        }
    }

    async getChannelAbilityFallback() {
        const titleResponse = await ApiClient.get('/cgi-bin/configManager.cgi', {
            params: {
                action: 'getConfig',
                name: 'ChannelTitle',
            },
        });

        const remoteDeviceResponse = await ApiClient.get('/cgi-bin/configManager.cgi', {
            params: {
                action: 'getConfig',
                name: 'RemoteDevice',
            },
        }).catch(() => ({ data: '' }));

        const titleParsed = this.parseKeyValuePayload(titleResponse?.data);
        const remoteParsed = this.parseKeyValuePayload(remoteDeviceResponse?.data);
        const enabledChannels = this.parseActiveChannelIds(remoteParsed);

        const abilities = {};

        Object.entries(titleParsed).forEach(([key, value]) => {
            const indexMatch = key.match(/\[(\d+)\]/);
            const titleMatch = key.toLowerCase().includes('channeltitle') || key.toLowerCase().includes('name');
            if (!indexMatch || !titleMatch) {
                return;
            }

            const channelId = Number(indexMatch[1]) + 1;
            if (enabledChannels.size > 0 && !enabledChannels.has(channelId)) {
                return;
            }

            const channelName = String(value || '').trim() || `Channel ${channelId}`;
            abilities[`Channel${channelId}`] = channelName;
        });

        return abilities;
    }

    /**
     * Get all available abilities/permissions
     */
    async getAbility() {
        // Device firmware on this project often does not implement userManager getAbility.
        // Use configManager as primary source to avoid noisy 501 on every refresh.
        try {
            const primaryAbilities = await this.getChannelAbilityFallback();
            if (primaryAbilities && Object.keys(primaryAbilities).length > 0) {
                return primaryAbilities;
            }
        } catch (error) {
            // Continue to optional legacy path below. suppressed console output
        }

        try {
            const response = await ApiClient.get('/cgi-bin/userManager.cgi', {
                params: { action: 'getAbility' },
            });
            return this.parseAbilityResponse(response.data);
        } catch (error) {
            if (this.isActionNotSupported(error)) {
                // If legacy endpoint is not implemented, return empty object
                // because channel/source data is already fetched from configManager.
                return {};
            }
            // suppressed detailed error logging
            throw error;
        }
    }

    /**
     * Get user info including current permissions
     */
    async getUserInfo(userName) {
        const actionFallbacks = ['getUserInfo', 'getUserInfoForName'];

        for (let i = 0; i < actionFallbacks.length; i += 1) {
            const action = actionFallbacks[i];
            try {
                const response = await ApiClient.get('/cgi-bin/userManager.cgi', {
                    params: {
                        action,
                        name: userName,
                    },
                });
                return this.parseUserInfoResponse(response.data);
            } catch (error) {
                const canFallback = i < actionFallbacks.length - 1 && this.isActionNotSupported(error);
                if (canFallback) {
                    continue;
                }
                // suppressed error logging
                throw error;
            }
        }

        throw new Error('Gagal mengambil data user.');
    }

    /**
     * Get group info including permissions
     */
    async getGroupInfo(groupName) {
        const actionFallbacks = ['getGroupInfo', 'getGroupInfoForName'];

        for (let i = 0; i < actionFallbacks.length; i += 1) {
            const action = actionFallbacks[i];
            try {
                const response = await ApiClient.get('/cgi-bin/userManager.cgi', {
                    params: {
                        action,
                        name: groupName,
                    },
                });
                return this.parseGroupInfoResponse(response.data);
            } catch (error) {
                const canFallback = i < actionFallbacks.length - 1 && this.isActionNotSupported(error);
                if (canFallback) {
                    continue;
                }
                // suppressed error logging
                throw error;
            }
        }

        throw new Error('Gagal mengambil data group.');
    }

    /**
     * Modify user permissions
     */
    async modifyUserPermissions(userName, authorities, authOptions = {}) {
        const attemptParams = [];
        const managerName = String(authOptions?.managerName || '').trim();
        const managerPwd = String(authOptions?.managerPwd || '').trim();
        const authorityVariants = this.buildAuthorityVariants(authorities);

        authorityVariants.forEach((list) => {
            const indexedAuthoritiesParams = {
                action: 'modifyUser',
                name: userName,
                ...(managerName ? { managerName } : {}),
                ...(managerPwd ? { password: managerPwd, managerPwd } : {}),
            };
            list.forEach((auth, index) => {
                indexedAuthoritiesParams[`authorities[${index}]`] = auth;
            });
            attemptParams.push(indexedAuthoritiesParams);

            const authorityListParams = {
                action: 'modifyUser',
                name: userName,
                ...(managerName ? { managerName } : {}),
                ...(managerPwd ? { password: managerPwd, managerPwd } : {}),
            };
            list.forEach((auth, index) => {
                authorityListParams[`AuthorityList[${index}]`] = auth;
            });
            attemptParams.push(authorityListParams);

            const userAuthorityListParams = {
                action: 'modifyUser',
                name: userName,
                ...(managerName ? { managerName } : {}),
                ...(managerPwd ? { password: managerPwd, managerPwd } : {}),
            };
            list.forEach((auth, index) => {
                userAuthorityListParams[`user.AuthorityList[${index}]`] = auth;
            });
            attemptParams.push(userAuthorityListParams);

            attemptParams.push({
                action: 'modifyUser',
                name: userName,
                AuthorityList: list.join(','),
                ...(managerName ? { managerName } : {}),
                ...(managerPwd ? { password: managerPwd, managerPwd } : {}),
            });
        });

        for (let i = 0; i < attemptParams.length; i += 1) {
            try {
                const response = await ApiClient.get('/cgi-bin/userManager.cgi', {
                    params: attemptParams[i],
                });
                const parsed = this.parseModifyResponse(response.data);
                if (parsed) {
                    return true;
                }
            } catch (error) {
                const canFallback = i < attemptParams.length - 1 && this.isActionNotSupported(error);
                if (canFallback) {
                    continue;
                }
                // suppressed error logging
                throw error;
            }
        }

        return false;
    }

    async modifyGroupPermissions(groupName, authorities, authOptions = {}) {
        const managerName = String(authOptions?.managerName || '').trim();
        const authorityVariants = this.buildAuthorityVariants(authorities);
        const requestBodyVariants = authorityVariants.map((list) => ({
            // Follow documentation shape for modifyGroup:
            // { "name": "groupName", "group": GroupInfo }
            name: groupName,
            group: {
                Name: groupName,
                AuthorityList: list,
            },
        }));

        // API-only flow for modifyGroup to match device documentation.
        // Auth handled via digest header, not in request body.
        for (let i = 0; i < requestBodyVariants.length; i += 1) {
            try {
                const response = await ApiClient.post('/cgi-bin/api/userManager/modifyGroup', requestBodyVariants[i]);
                const parsed = this.parseModifyResponse(response?.data);
                if (parsed) {
                    return true;
                }
            } catch (error) {
                // Continue trying next payload variant for API endpoint.
                const status = error?.response?.status;
                const canTryNextVariant = status === 400 || status === 404 || status === 405 || status === 501;
                if (canTryNextVariant || this.isActionNotSupported(error)) {
                    continue;
                }
                // If API exists but returned business/auth error, surface it.
                throw error;
            }
        }

        return false;
    }

    /**
     * Parse ability response
     */
    parseAbilityResponse(data) {
        return this.parseKeyValuePayload(data);
    }

    /**
     * Parse user info response
     */
    parseUserInfoResponse(data) {
        return this.parseKeyValuePayload(data);
    }

    /**
     * Parse group info response
     */
    parseGroupInfoResponse(data) {
        return this.parseKeyValuePayload(data);
    }

    /**
     * Parse modify response
     */
    parseModifyResponse(data) {
        if (typeof data === 'string') {
            const text = data.toLowerCase();
            if (text.includes('error') || text.includes('failed') || text.includes('invalid')) {
                return false;
            }
            return text.includes('success') || text.includes('ok');
        }
        return !!data;
    }
}

export const permissionService = new PermissionService();
