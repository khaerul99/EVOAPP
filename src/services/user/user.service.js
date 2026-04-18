import ApiClient from '../../lib/api';

function toTextPayload(rawData) {
    if (typeof rawData === 'string') {
        return rawData;
    }

    if (rawData === null || rawData === undefined) {
        return '';
    }

    if (typeof rawData === 'object') {
        try {
            return JSON.stringify(rawData);
        } catch {
            return String(rawData);
        }
    }

    return String(rawData);
}

function parseKeyValuePayload(rawData) {
    const payload = toTextPayload(rawData);
    const output = {};

    payload
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

            output[key] = value;
        });

    return output;
}

function pickFirstValue(source, candidates) {
    for (const key of candidates) {
        const value = source?.[key];
        if (value === undefined || value === null) {
            continue;
        }

        const text = String(value).trim();
        if (text) {
            return text;
        }
    }

    return '';
}

function normalizeUserRecord(user, index = 0) {
    const name = pickFirstValue(user, ['Name', 'name', 'UserName', 'username', 'User', 'user']);
    const group = pickFirstValue(user, ['GroupName', 'Group', 'group', 'UserGroup', 'AuthorityList']);
    const remark = pickFirstValue(user, ['Memo', 'memo', 'Remark', 'remark', 'Comment']);
    const authority = pickFirstValue(user, ['Authority', 'authority', 'Level', 'level', 'Type', 'type']);
    const authorities = Array.isArray(user?.AuthorityList)
        ? user.AuthorityList.map((entry) => String(entry || '').trim()).filter(Boolean)
        : [];

    return {
        id: index + 1,
        name: name || '-',
        group: group || '-',
        authority: authority || '-',
        remark,
        authorities,
        raw: user,
    };
}

function parseUsersFromObjectPayload(rawData) {
    if (Array.isArray(rawData)) {
        return rawData.map((entry, index) => normalizeUserRecord(entry || {}, index));
    }

    if (!rawData || typeof rawData !== 'object') {
        return [];
    }

    const objectValues = Object.values(rawData);
    const hasObjectArray = objectValues.every((value) => value && typeof value === 'object');
    if (hasObjectArray && objectValues.length > 0) {
        return objectValues.map((entry, index) => normalizeUserRecord(entry || {}, index));
    }

    return [normalizeUserRecord(rawData, 0)];
}

function parseUsersFromKeyValuePayload(rawData) {
    const keyValueMap = parseKeyValuePayload(rawData);
    const groupedUsers = {};

    const patterns = [
        /^(?:table\.)?(?:userInfo|users?|user)\[(\d+)\]\.(.+)$/i,
        /^(?:table\.)?(?:userInfo|users?|user)\.([^.]+)\.(.+)$/i,
    ];

    Object.entries(keyValueMap).forEach(([key, value]) => {
        let matched = false;

        const authorityMatch = key.match(/^(?:table\.)?(?:userInfo|users?|user)\[(\d+)\]\.AuthorityList\[(\d+)\]$/i)
            || key.match(/^(?:table\.)?(?:userInfo|users?|user)\.([^.]+)\.AuthorityList\[(\d+)\]$/i);
        if (authorityMatch) {
            const userId = String(authorityMatch[1] || '').trim();
            const index = String(authorityMatch[2] || '').trim();
            if (userId) {
                if (!groupedUsers[userId]) {
                    groupedUsers[userId] = {};
                }
                if (!Array.isArray(groupedUsers[userId].AuthorityList)) {
                    groupedUsers[userId].AuthorityList = [];
                }
                groupedUsers[userId].AuthorityList[Number(index)] = value;
                return;
            }
        }

        for (const pattern of patterns) {
            const match = key.match(pattern);
            if (!match) {
                continue;
            }

            const userId = String(match[1] || '').trim();
            const field = String(match[2] || '').trim();
            if (!userId || !field) {
                return;
            }

            if (!groupedUsers[userId]) {
                groupedUsers[userId] = {};
            }

            groupedUsers[userId][field] = value;
            matched = true;
            break;
        }

        if (matched) {
            return;
        }

        if (/\bname$/i.test(key)) {
            if (!groupedUsers.single) {
                groupedUsers.single = {};
            }
            groupedUsers.single[key] = value;
        }
    });

    const users = Object.keys(groupedUsers).map((userId) => {
        const raw = groupedUsers[userId] || {};
        const normalized = { ...raw };

        Object.keys(raw).forEach((field) => {
            const normalizedField = field.includes('.') ? field.split('.').pop() : field;
            normalized[normalizedField] = raw[field];
        });

        if (Array.isArray(raw.AuthorityList)) {
            normalized.AuthorityList = raw.AuthorityList.filter(Boolean);
        }

        return normalized;
    });

    if (users.length > 0) {
        return users.map((entry, index) => normalizeUserRecord(entry, index));
    }

    return [];
}

function parseUserList(rawData) {
    if (rawData && typeof rawData === 'object') {
        return parseUsersFromObjectPayload(rawData);
    }

    const users = parseUsersFromKeyValuePayload(rawData);
    if (users.length > 0) {
        return users;
    }

    return [];
}

function parseQueryStringInput(queryString) {
    const params = {};
    const raw = String(queryString || '').trim();
    if (!raw) {
        return params;
    }

    raw
        .replace(/^\?/, '')
        .split('&')
        .map((part) => part.trim())
        .filter(Boolean)
        .forEach((part) => {
            const [key, ...rest] = part.split('=');
            const normalizedKey = decodeURIComponent(String(key || '').trim());
            if (!normalizedKey) {
                return;
            }

            const joinedValue = rest.join('=');
            params[normalizedKey] = decodeURIComponent(String(joinedValue || '').trim());
        });

    return params;
}

function normalizeAuthorityList(authorityInput) {
    if (Array.isArray(authorityInput)) {
        return authorityInput.map((entry) => String(entry || '').trim()).filter(Boolean);
    }

    return String(authorityInput || '')
        .split(',')
        .map((entry) => String(entry || '').trim())
        .filter(Boolean);
}

function isBadRequestError(error) {
    const status = error?.response?.status;
    const body = String(error?.response?.data || '').toLowerCase();
    return status === 400 || body.includes('bad request');
}

function isAuthError(error) {
    const status = error?.response?.status;
    return status === 401 || status === 403;
}

function isFailedActionPayload(data) {
    if (data === null || data === undefined) {
        return false;
    }

    const text = String(data).trim().toLowerCase();
    if (!text) {
        return false;
    }

    const hasFailureSignal = text.includes('error')
        || text.includes('failed')
        || text.includes('bad request')
        || text.includes('invalid')
        || text.includes('denied');
    const hasSuccessSignal = text.includes('ok') || text.includes('success');

    return hasFailureSignal && !hasSuccessSignal;
}

async function callUserManagerWithParamFallback(paramVariants = []) {
    let lastError;

    for (const params of paramVariants) {
        try {
            const response = await ApiClient.get('/cgi-bin/userManager.cgi', {
                params,
            });

            if (isFailedActionPayload(response?.data)) {
                const actionError = new Error(String(response?.data || 'User manager action failed.'));
                actionError.response = { data: response?.data, status: response?.status };
                throw actionError;
            }

            return response?.data;
        } catch (error) {
            if (isAuthError(error)) {
                throw error;
            }

            lastError = error;
        }
    }

    if (lastError) {
        throw lastError;
    }

    throw new Error('Tidak ada format parameter yang bisa dipakai untuk request userManager.');
}

function buildAddUserParams(payload = {}, extraQuery = '', mode = 'nested', options = {}) {
    const action = String(options?.action || 'addUser').trim() || 'addUser';
    const profile = String(options?.profile || 'full').trim();
    const authorityMode = String(options?.authorityMode || 'default').trim();
    const name = String(payload?.name || '').trim();
    const password = String(payload?.password || '').trim();
    const group = String(payload?.group || '').trim();
    const memo = String(payload?.remark || '').trim();
    const sharable = payload?.sharable !== undefined ? String(Boolean(payload.sharable)) : 'true';
    const reserved = payload?.reserved !== undefined ? String(Boolean(payload.reserved)) : 'false';
    const needModPwd = payload?.needModPwd !== undefined ? String(Boolean(payload.needModPwd)) : 'false';
    const authorityList = normalizeAuthorityList(payload?.authority);

    const params = mode === 'flat'
        ? {
            action,
            name,
            pwd: password,
            Name: name,
            Password: password,
        }
        : {
            action,
            'user.Name': name,
            'user.Password': password,
        };

    if (profile === 'full') {
        if (mode === 'flat') {
            params.sharable = sharable;
            params.reserved = reserved;
            params.needModPwd = needModPwd;
        } else {
            params['user.Sharable'] = sharable;
            params['user.Reserved'] = reserved;
            params['user.NeedModPwd'] = needModPwd;
        }
    }

    if (group) {
        params[mode === 'flat' ? 'group' : 'user.Group'] = group;
        if (mode === 'flat' && profile === 'minimal') {
            params.Group = group;
        }
    }

    if (memo) {
        params[mode === 'flat' ? 'memo' : 'user.Memo'] = memo;
    }

    if (authorityList.length > 0) {
        authorityList.forEach((entry, index) => {
            let authorityKey;
            if (mode === 'flat') {
                authorityKey = authorityMode === 'AuthorityList'
                    ? `AuthorityList[${index}]`
                    : `authorities[${index}]`;
            } else {
                authorityKey = `user.AuthorityList[${index}]`;
            }
            params[authorityKey] = entry;
        });

        if (mode === 'flat') {
            params.authority = authorityList.join(',');
        }
    }

    return {
        ...params,
        ...parseQueryStringInput(extraQuery),
    };
}

function buildModifyUserParams(payload = {}, extraQuery = '', fallbackAuthorities = [], mode = 'nested', options = {}) {
    const action = String(options?.action || 'modifyUser').trim() || 'modifyUser';
    const profile = String(options?.profile || 'full').trim();
    const authorityMode = String(options?.authorityMode || 'default').trim();
    const name = String(payload?.name || '').trim();
    const password = String(payload?.password || '').trim();
    const group = String(payload?.group || '').trim();
    const memo = String(payload?.remark || '').trim();
    const sharable = payload?.sharable !== undefined ? String(Boolean(payload.sharable)) : 'true';
    const reserved = payload?.reserved !== undefined ? String(Boolean(payload.reserved)) : 'false';
    const authorities = normalizeAuthorityList(payload?.authority);
    const mergedAuthorities = authorities.length > 0 ? authorities : normalizeAuthorityList(fallbackAuthorities);

    const params = mode === 'flat'
        ? {
            action,
            name,
            oldName: name,
            Name: name,
        }
        : {
            action,
            name,
        };

    if (profile === 'full') {
        if (mode === 'flat') {
            params.sharable = sharable;
            params.reserved = reserved;
        } else {
            params['user.Sharable'] = sharable;
            params['user.Reserved'] = reserved;
        }
    }

    if (name) {
        if (mode !== 'flat') {
            params['user.Name'] = name;
        } else {
            params.userName = name;
        }
    }

    if (password) {
        params[mode === 'flat' ? 'pwd' : 'user.Password'] = password;
        if (mode === 'flat') {
            params.Password = password;
        }
    }

    if (group) {
        params[mode === 'flat' ? 'group' : 'user.Group'] = group;
        if (mode === 'flat' && profile === 'minimal') {
            params.Group = group;
        }
    }

    if (memo) {
        params[mode === 'flat' ? 'memo' : 'user.Memo'] = memo;
    }

    if (mergedAuthorities.length > 0) {
        mergedAuthorities.forEach((entry, index) => {
            let authorityKey;
            if (mode === 'flat') {
                authorityKey = authorityMode === 'AuthorityList'
                    ? `AuthorityList[${index}]`
                    : `authorities[${index}]`;
            } else {
                authorityKey = `user.AuthorityList[${index}]`;
            }
            params[authorityKey] = entry;
        });

        if (mode === 'flat') {
            params.authority = mergedAuthorities.join(',');
        }
    }

    return {
        ...params,
        ...parseQueryStringInput(extraQuery),
    };
}

export const userService = {
    getAllUsers: async () => {
        const response = await ApiClient.get('/cgi-bin/userManager.cgi', {
            params: { action: 'getUserInfoAll' },
        });

        return {
            users: parseUserList(response?.data),
            raw: response?.data,
        };
    },

    getUserByName: async (name) => {
        const response = await ApiClient.get('/cgi-bin/userManager.cgi', {
            params: {
                action: 'getUserInfo',
                name,
            },
        });

        const parsedUsers = parseUserList(response?.data);
        return {
            user: parsedUsers[0] || null,
            raw: response?.data,
        };
    },

    addUser: async ({ payload = {}, extraQuery = '' }) => {
        return callUserManagerWithParamFallback([
            buildAddUserParams(payload, extraQuery, 'nested', { profile: 'minimal' }),
            buildAddUserParams(payload, extraQuery, 'flat', { profile: 'minimal', authorityMode: 'default' }),
        ]);
    },

    modifyUser: async ({ payload = {}, extraQuery = '' }) => {
        try {
            return await callUserManagerWithParamFallback([
                buildModifyUserParams(payload, extraQuery, [], 'nested', { profile: 'minimal' }),
                buildModifyUserParams(payload, extraQuery, [], 'flat', { profile: 'minimal', authorityMode: 'default' }),
            ]);
        } catch (error) {
            if (!isBadRequestError(error)) {
                throw error;
            }

            const currentUser = await userService.getUserByName(payload?.name);
            const fallbackAuthorities = currentUser?.user?.authorities || currentUser?.user?.raw?.AuthorityList || [];
            return callUserManagerWithParamFallback([
                buildModifyUserParams(payload, extraQuery, fallbackAuthorities, 'nested', { profile: 'full' }),
                buildModifyUserParams(payload, extraQuery, fallbackAuthorities, 'flat', { profile: 'full', authorityMode: 'default' }),
            ]);
        }
    },

    deleteUser: async ({ name, extraQuery = '' }) => {
        const response = await ApiClient.get('/cgi-bin/userManager.cgi', {
            params: {
                action: 'deleteUser',
                name,
                ...parseQueryStringInput(extraQuery),
            },
        });

        return response?.data;
    },

    getOnvifDevice: async () => {
        const response = await ApiClient.get('/cgi-bin/configManager.cgi', {
            params: {
                action: 'getConfig',
                name: 'OnvifDevice',
            },
        });

        return {
            data: parseKeyValuePayload(response?.data),
            raw: response?.data,
        };
    },

    modifyPassword: async ({ name, pwd, pwdOld, extraQuery = '' }) => {
        const response = await ApiClient.get('/cgi-bin/userManager.cgi', {
            params: {
                action: 'modifyPassword',
                name,
                pwd,
                pwdOld,
                ...parseQueryStringInput(extraQuery),
            },
        });

        return response?.data;
    },

    modifyPasswordByManager: async ({ userName, pwd, managerName, managerPwd, accountType = 0, extraQuery = '' }) => {
        const response = await ApiClient.get('/cgi-bin/userManager.cgi', {
            params: {
                action: 'modifyPasswordByManager',
                userName,
                pwd,
                managerName,
                managerPwd,
                accountType,
                ...parseQueryStringInput(extraQuery),
            },
        });

        return response?.data;
    },
};
