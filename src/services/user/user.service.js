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

    return {
        id: index + 1,
        name: name || '-',
        group: group || '-',
        authority: authority || '-',
        remark,
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

function buildUserPayload(basePayload = {}, extraQuery = '') {
    const payload = {};

    Object.entries(basePayload).forEach(([key, value]) => {
        const text = String(value ?? '').trim();
        if (!text) {
            return;
        }
        payload[key] = text;
    });

    return {
        ...payload,
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
            params: {
                action: 'addUser',
                ...buildUserPayload(payload, extraQuery),
            },
        });

        return response?.data;
    },

    modifyUser: async ({ payload = {}, extraQuery = '' }) => {
        const response = await ApiClient.get('/cgi-bin/userManager.cgi', {
            params: {
                action: 'modifyUser',
                ...buildUserPayload(payload, extraQuery),
            },
        });

        return response?.data;
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
};
