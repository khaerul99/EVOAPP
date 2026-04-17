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

function buildAddUserParams(payload = {}, extraQuery = '') {
    const name = String(payload?.name || '').trim();
    const password = String(payload?.password || '').trim();
    const group = String(payload?.group || '').trim();
    const memo = String(payload?.remark || '').trim();
    const sharable = payload?.sharable !== undefined ? String(Boolean(payload.sharable)) : 'true';
    const reserved = payload?.reserved !== undefined ? String(Boolean(payload.reserved)) : 'false';
    const needModPwd = payload?.needModPwd !== undefined ? String(Boolean(payload.needModPwd)) : 'false';
    const authorityList = normalizeAuthorityList(payload?.authority);

    const params = {
        action: 'addUser',
        'user.Name': name,
        'user.Password': password,
        'user.Sharable': sharable,
        'user.Reserved': reserved,
        'user.NeedModPwd': needModPwd,
    };

    if (group) {
        params['user.Group'] = group;
    }

    if (memo) {
        params['user.Memo'] = memo;
    }

    if (authorityList.length > 0) {
        authorityList.forEach((entry, index) => {
            params[`user.AuthorityList[${index}]`] = entry;
        });
    }

    return {
        ...params,
        ...parseQueryStringInput(extraQuery),
    };
}

function buildModifyUserParams(payload = {}, extraQuery = '', fallbackAuthorities = []) {
    const name = String(payload?.name || '').trim();
    const password = String(payload?.password || '').trim();
    const group = String(payload?.group || '').trim();
    const memo = String(payload?.remark || '').trim();
    const sharable = payload?.sharable !== undefined ? String(Boolean(payload.sharable)) : 'true';
    const reserved = payload?.reserved !== undefined ? String(Boolean(payload.reserved)) : 'false';
    const authorities = normalizeAuthorityList(payload?.authority);
    const mergedAuthorities = authorities.length > 0 ? authorities : normalizeAuthorityList(fallbackAuthorities);

    const params = {
        action: 'modifyUser',
        name,
        'user.Sharable': sharable,
        'user.Reserved': reserved,
    };

    if (name) {
        params['user.Name'] = name;
    }

    if (password) {
        params['user.Password'] = password;
    }

    if (group) {
        params['user.Group'] = group;
    }

    if (memo) {
        params['user.Memo'] = memo;
    }

    if (mergedAuthorities.length > 0) {
        mergedAuthorities.forEach((entry, index) => {
            params[`user.AuthorityList[${index}]`] = entry;
        });
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
        const response = await ApiClient.get('/cgi-bin/userManager.cgi', {
            params: buildAddUserParams(payload, extraQuery),
        });

        return response?.data;
    },

    modifyUser: async ({ payload = {}, extraQuery = '' }) => {
        try {
            const response = await ApiClient.get('/cgi-bin/userManager.cgi', {
                params: buildModifyUserParams(payload, extraQuery),
            });

            return response?.data;
        } catch (error) {
            if (!isBadRequestError(error)) {
                throw error;
            }

            const currentUser = await userService.getUserByName(payload?.name);
            const fallbackAuthorities = currentUser?.user?.authorities || currentUser?.user?.raw?.AuthorityList || [];
            const retryResponse = await ApiClient.get('/cgi-bin/userManager.cgi', {
                params: buildModifyUserParams(payload, extraQuery, fallbackAuthorities),
            });

            return retryResponse?.data;
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
