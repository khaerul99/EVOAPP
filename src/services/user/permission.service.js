import ApiClient from '../../lib/api';

class PermissionService {
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
            // Continue to optional legacy path below.
            console.log('Primary ability source failed, trying userManager getAbility:', error);
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

            console.error('Failed to get abilities:', error);
            console.error('Response status:', error?.response?.status);
            console.error('Response data:', error?.response?.data);

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
                console.error(`Failed to get user info for ${userName}:`, error);
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
                console.error(`Failed to get group info for ${groupName}:`, error);
                throw error;
            }
        }

        throw new Error('Gagal mengambil data group.');
    }

    /**
     * Modify user permissions
     */
    async modifyUserPermissions(userName, authorities) {
        const attemptParams = [];

        const indexedAuthoritiesParams = {
            action: 'modifyUser',
            name: userName,
        };
        authorities.forEach((auth, index) => {
            indexedAuthoritiesParams[`authorities[${index}]`] = auth;
        });
        attemptParams.push(indexedAuthoritiesParams);

        attemptParams.push({
            action: 'modifyUser',
            name: userName,
            AuthorityList: authorities.join(','),
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
                console.error(`Failed to modify permissions for ${userName}:`, error);
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
