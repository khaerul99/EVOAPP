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
        .filter(([, value]) => value !== undefined && value !== null && value !== "")
        .map(([key, value]) => `${key}=${encodeURIComponent(String(value))}`)
        .join("&");
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
        toNumber(device["Channels[0].uniqueChannel"]),
        toNumber(device["Channels[0].channel"]),
        toNumber(device.LogicChannelStart),
    ].filter((value) => value !== null && value >= 0);

    if (candidates.length > 0) {
        return candidates[0];
    }

    return null;
}

function mapRemoteDevicesByChannelIndex(channelTitles, remoteDevices) {
    const sorted = [...(remoteDevices || [])].sort((left, right) =>
        String(left.objectId || "").localeCompare(String(right.objectId || ""), undefined, {
            numeric: true,
            sensitivity: "base",
        }),
    );

    const mapping = {};
    const unresolved = [];

    sorted.forEach((device) => {
        const resolvedIndex = resolveChannelIndex(device);
        const canUseResolved = resolvedIndex !== null
            && resolvedIndex >= 0
            && !mapping[resolvedIndex];

        if (canUseResolved) {
            mapping[resolvedIndex] = device;
            return;
        }

        unresolved.push(device);
    });

    const isDefaultChannelTitle = (title) => /^channel\s*\d+$/i.test(String(title || "").trim());
    const candidateIndexes = Object.keys(channelTitles)
        .map((key) => Number(key))
        .filter((value) => Number.isFinite(value))
        .sort((a, b) => a - b);

    const nonDefaultFreeIndexes = candidateIndexes.filter((index) => {
        if (mapping[index]) {
            return false;
        }
        const channelName = String(channelTitles[index] || "").trim();
        return channelName && !isDefaultChannelTitle(channelName);
    });

    const defaultFreeIndexes = candidateIndexes.filter((index) => !mapping[index] && !nonDefaultFreeIndexes.includes(index));
    const fallbackIndexes = [...nonDefaultFreeIndexes, ...defaultFreeIndexes];

    unresolved.forEach((device, idx) => {
        const targetIndex = fallbackIndexes[idx];
        if (targetIndex === undefined) {
            return;
        }
        mapping[targetIndex] = device;
    });

    return mapping;
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
    if (["1", "true", "online", "connect", "connected", "up", "ok", "normal", "alive", "enable", "enabled", "active"].includes(normalized)) {
        return "online";
    }
    if (["0", "false", "offline", "disconnect", "disconnected", "down", "error", "failed", "fail", "timeout", "disable", "disabled", "inactive"].includes(normalized)) {
        return "offline";
    }
    if (["", "unknown", "null", "undefined"].includes(normalized)) {
        return "unknown";
    }
    return "offline";
}

function resolveRemoteConnectionState(remote) {
    return firstNonEmpty(
        remote.Online,
        remote.Status,
        remote.ConnectStatus,
        remote.ConnectState,
        remote.ConnectionState,
        remote.NetStatus,
        remote.State,
        "",
    );
}

function resolveCameraStatus(remote, { record, hasConfiguredRemote, remoteChannelNumber, hasDeviceIdentity }) {
    const connectionState = resolveRemoteConnectionState(remote);
    if (connectionState) {
        const normalizedFromConnection = normalizeOnlineStatus(connectionState);
        if (normalizedFromConnection !== "unknown") {
            return normalizedFromConnection;
        }
    }

    if (remoteChannelNumber !== null) {
        return remoteChannelNumber > 0 ? "online" : "offline";
    }

    if (record) {
        return "online";
    }

    if (hasDeviceIdentity) {
        return "online";
    }

    if (hasConfiguredRemote) {
        return "offline";
    }

    return "unknown";
}

function normalizeRecordFlag(value) {
    const normalized = String(value || "").trim().toLowerCase();
    return ["1", "true", "on", "enabled", "recording"].includes(normalized);
}

function resolveStatusMessage(remote, status) {
    const explicitMessage = firstNonEmpty(
        remote.ErrorMsg,
        remote.Error,
        remote.LastError,
        remote.FailReason,
        remote.LoginError,
        "",
    );

    if (explicitMessage) {
        return explicitMessage;
    }

    if (status === "offline") {
        return "Connection failed while logging in.";
    }

    return "";
}

function hasConfiguredRemote(remote) {
    return Boolean(firstNonEmpty(
        remote.Address,
        remote.IPAddress,
        remote.IP,
        remote.Name,
        remote.DeviceID,
        remote.Protocol,
        remote.ProtocolType,
        remote.SerialNo,
        remote.SN,
    ));
}

function hasDeviceIdentity(remote) {
    return Boolean(firstNonEmpty(
        remote.Model,
        remote.DeviceModel,
        remote.SerialNo,
        remote.SN,
    ));
}

function toCameraRows(channelTitles, remoteDevicesByIndex) {
    const mappedIndexes = Object.keys(remoteDevicesByIndex)
        .map((key) => Number(key))
        .filter((index) => Number.isFinite(index));
    const indexes = new Set(
        mappedIndexes.length > 0
            ? mappedIndexes
            : Object.keys(channelTitles).map((key) => Number(key)),
    );

    return Array.from(indexes)
        .filter((index) => Number.isFinite(index))
        .sort((a, b) => a - b)
        .map((index) => {
            const channelName = firstNonEmpty(channelTitles[index], `Channel ${index + 1}`);
            const remote = remoteDevicesByIndex[index] || {};
            const configuredRemote = hasConfiguredRemote(remote);
            const remoteChannelNoRaw = firstNonEmpty(
                remote["Channels[0].channel"],
                remote["Channels[0].uniqueChannel"],
                remote.RemoteChannel,
                remote["assignLocalChannel[0]"],
                remote.LogicChannelStart,
                "",
            );
            const remoteChannelNumber = toNumber(remoteChannelNoRaw);
            const remoteChannelNo = remoteChannelNoRaw || (configuredRemote ? "1" : "--");
            const inferredRecordFlag = normalizeRecordFlag(firstNonEmpty(remote.RecordEnable, remote.RecEnable, ""));
            const identityPresent = hasDeviceIdentity(remote);
            const record = inferredRecordFlag || (configuredRemote && remoteChannelNumber !== null && remoteChannelNumber > 0) || identityPresent;
            const status = resolveCameraStatus(remote, {
                record,
                hasConfiguredRemote: configuredRemote,
                remoteChannelNumber,
                hasDeviceIdentity: identityPresent,
            });

            const deviceName = firstNonEmpty(remote.Name, "-");

            return {
                id: index + 1,
                name: channelName,
                channelName,
                deviceName,
                ip: firstNonEmpty(remote.Address, remote.IPAddress, remote.IP, "-"),
                port: firstNonEmpty(remote.Port, remote.HttpPort, remote.RTSPPort, "8000"),
                status,
                statusMessage: resolveStatusMessage(remote, status),
                record,
                registrationNo: firstNonEmpty(remote.DeviceID, remote.RegisterNo, remote.RegNo, "--"),
                username: firstNonEmpty(remote.UserName, remote.Username, remote.Login, "admin"),
                passwordMasked: firstNonEmpty(remote.Password, remote.PassWord, remote.Pwd, "") ? "******" : "--",
                manufacture: firstNonEmpty(remote.ProtocolType, remote.Protocol, remote.Vendor, "Unknown"),
                model: firstNonEmpty(remote.Model, remote.DeviceModel, "--"),
                sn: firstNonEmpty(remote.SerialNo, remote.SN, "--"),
                remoteChannelNo,
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
        const parsedRemoteDevices = remoteDeviceResult.status === "fulfilled"
            ? parseRemoteDevices(remoteDeviceResult.value?.data)
            : [];
        const remoteDevicesByIndex = mapRemoteDevicesByChannelIndex(channelTitles, parsedRemoteDevices);

        return toCameraRows(channelTitles, remoteDevicesByIndex);
    },

    addRemoteDevice: async ({
        channelIndex = 0,
        ipAddress,
        port = "37777",
        username = "admin",
        password = "admin123",
        protocol = "Private",
    }) => {
        const query = buildConfigManagerQuery({
            action: "setConfig",
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
