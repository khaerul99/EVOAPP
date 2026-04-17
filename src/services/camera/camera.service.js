import ApiClient from "../../lib/api";

function parseKeyValuePayload(rawData) {
    const payload = typeof rawData === "string" ? rawData : String(rawData || "");
    const output = {};
    const lines = payload.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);

    lines.forEach((line) => {
        const separatorIndex = line.indexOf("=");
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

function parseChannelTitles(rawData) {
    const payload = typeof rawData === "string" ? rawData : String(rawData || "");
    const matches = [...payload.matchAll(/table\.ChannelTitle\[(\d+)\]\.Name=(.*)/g)];

    return matches.reduce((accumulator, entry) => {
        const index = Number(entry[1]);
        if (!Number.isFinite(index)) {
            return accumulator;
        }

        accumulator[index] = String(entry[2] || "").trim() || `Channel ${index + 1}`;
        return accumulator;
    }, {});
}

function buildConfigManagerQuery(params) {
    return Object.entries(params || {})
        .filter(([, value]) => value !== undefined && value !== null && value !== '')
        .map(([key, value]) => `${key}=${encodeURIComponent(String(value))}`)
        .join('&');
}

function parseRemoteDevices(rawData) {
    const keyValueMap = parseKeyValuePayload(rawData);
    const groupedByDeviceId = {};

    Object.entries(keyValueMap).forEach(([key, value]) => {
        const objectMatch = key.match(/^table\.RemoteDevice\.([^.]+)\.(.+)$/);
        if (objectMatch) {
            const objectId = String(objectMatch[1] || "").trim();
            const field = String(objectMatch[2] || "").trim();
            if (!objectId || !field) {
                return;
            }

            if (!groupedByDeviceId[objectId]) {
                groupedByDeviceId[objectId] = {};
            }
            groupedByDeviceId[objectId][field] = value;
            return;
        }

        const indexedMatch = key.match(/^table\.RemoteDevice\[(\d+)\]\.(.+)$/);
        if (!indexedMatch) {
            return;
        }

        const index = Number(indexedMatch[1]);
        const field = String(indexedMatch[2] || "").trim();
        if (!Number.isFinite(index) || !field) {
            return;
        }

        const objectId = `indexed_${String(index).padStart(6, "0")}`;
        if (!groupedByDeviceId[objectId]) {
            groupedByDeviceId[objectId] = {};
        }
        groupedByDeviceId[objectId][field] = value;
    });

    return Object.entries(groupedByDeviceId).map(([objectId, device]) => ({
        objectId,
        ...device,
    }));
}

function toNumber(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}

function extractObjectSequence(objectId) {
    const match = String(objectId || "").match(/(\d+)$/);
    if (!match) {
        return null;
    }
    return toNumber(match[1]);
}

function resolveChannelIndex(device) {
    const candidates = [
        toNumber(device["assignLocalChannel[0]"]),
        toNumber(device.LogicChannelStart),
        toNumber(device["Channels[0].channel"]),
        toNumber(device["Channels[0].uniqueChannel"]),
    ].filter((value) => value !== null && value >= 0);

    if (candidates.length > 0) {
        return candidates[0];
    }

    const sequence = extractObjectSequence(device.objectId);
    if (sequence !== null && sequence > 0) {
        return sequence - 1;
    }

    return null;
}

function mapRemoteDevicesByChannelIndex(remoteDevices) {
    const sorted = [...(remoteDevices || [])].sort((left, right) =>
        String(left.objectId || "").localeCompare(String(right.objectId || ""), undefined, {
            numeric: true,
            sensitivity: "base",
        }),
    );

    return sorted.reduce((accumulator, device, index) => {
        const resolvedIndex = resolveChannelIndex(device);
        const safeIndex = resolvedIndex !== null && resolvedIndex >= 0 ? resolvedIndex : index;
        accumulator[safeIndex] = device;
        return accumulator;
    }, {});
}

function firstNonEmpty(...candidates) {
    for (const candidate of candidates) {
        if (candidate === undefined || candidate === null) {
            continue;
        }

        const text = String(candidate).trim();
        if (text) {
            return text;
        }
    }
    return "";
}

function normalizeOnlineStatus(value) {
    const normalized = String(value || "").trim().toLowerCase();
    if (["1", "true", "online", "connect", "connected", "up", "enable", "enabled"].includes(normalized)) {
        return "online";
    }
    return "offline";
}

function normalizeRecordFlag(value) {
    const normalized = String(value || "").trim().toLowerCase();
    return ["1", "true", "on", "enabled", "recording"].includes(normalized);
}

function toCameraRows(channelTitles, remoteDevices) {
    const indexes = new Set([
        ...Object.keys(channelTitles).map((key) => Number(key)),
        ...Object.keys(remoteDevices).map((key) => Number(key)),
    ]);

    return Array.from(indexes)
        .filter((index) => Number.isFinite(index))
        .sort((a, b) => a - b)
        .map((index) => {
            const remote = remoteDevices[index] || {};
            const channelName = firstNonEmpty(channelTitles[index], `Channel ${index + 1}`);
            const deviceName = firstNonEmpty(remote.Name, remote.SerialNo, remote.Vendor, "-");

            return {
                id: index + 1,
                name: channelName,
                channelName,
                deviceName,
                ip: firstNonEmpty(remote.Address, remote.IPAddress, remote.IP, "-"),
                port: firstNonEmpty(remote.Port, remote.HttpPort, remote.RTSPPort, "8000"),
                status: normalizeOnlineStatus(firstNonEmpty(remote.Enable, remote.Online, remote.Status, "0")),
                record: normalizeRecordFlag(firstNonEmpty(remote.RecordEnable, remote.RecEnable, remote.Enable, "0")),
                manufacture: firstNonEmpty(remote.ProtocolType, remote.Protocol, remote.Vendor, "Unknown"),
            };
        });
}

export const cameraService = {
    getCameraChannels: async () => {
        const [channelTitleResult, remoteDeviceResult] = await Promise.allSettled([
            ApiClient.get("/cgi-bin/configManager.cgi?action=getConfig&name=ChannelTitle"),
            ApiClient.get("/cgi-bin/configManager.cgi?action=getConfig&name=RemoteDevice"),
        ]);

        if (channelTitleResult.status !== "fulfilled") {
            throw channelTitleResult.reason;
        }

        const channelTitles = parseChannelTitles(channelTitleResult.value?.data);
        const remoteDevices = remoteDeviceResult.status === "fulfilled"
            ? mapRemoteDevicesByChannelIndex(parseRemoteDevices(remoteDeviceResult.value?.data))
            : {};

        return toCameraRows(channelTitles, remoteDevices);
    },
    addRemoteDevice: async ({
        channelIndex = 0,
        ipAddress,
        port = '37777',
        username = 'admin',
        password = 'admin123',
        protocol = 'Private',
    }) => {
        const query = buildConfigManagerQuery({
            action: 'setConfig',
            [`RemoteDevice[${channelIndex}].Address`]: ipAddress,
            [`RemoteDevice[${channelIndex}].Port`]: port,
            [`RemoteDevice[${channelIndex}].Username`]: username,
            [`RemoteDevice[${channelIndex}].Password`]: password,
            [`RemoteDevice[${channelIndex}].Protocol`]: protocol,
        });

        const response = await ApiClient.get(`/cgi-bin/configManager.cgi?${query}`);
        return response?.data;
    },
};
