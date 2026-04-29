import ApiClient from "../../lib/api";
import { warmupDigestChallenge } from "../auth/digest-warmup.service";

const CAMERA_CHANNELS_CACHE_TTL_MS = Number(
  import.meta.env.VITE_CAMERA_CHANNELS_CACHE_TTL_MS || 8000,
);

let cameraChannelsCache = {
  rows: null,
  fetchedAt: 0,
};
let cameraChannelsInFlightPromise = null;
let cameraStatusSnapshotCache = {
  data: null,
  fetchedAt: 0,
};
let cameraStatusSnapshotPromise = null;

function getCachedCameraRows() {
  const ttl = Number.isFinite(CAMERA_CHANNELS_CACHE_TTL_MS)
    ? Math.max(0, CAMERA_CHANNELS_CACHE_TTL_MS)
    : 0;
  if (!ttl) {
    return null;
  }

  const age = Date.now() - Number(cameraChannelsCache.fetchedAt || 0);
  if (!Array.isArray(cameraChannelsCache.rows) || age > ttl) {
    return null;
  }

  return [...cameraChannelsCache.rows];
}

function updateCameraRowsCache(rows) {
  cameraChannelsCache = {
    rows: Array.isArray(rows) ? [...rows] : [],
    fetchedAt: Date.now(),
  };
}

function clearCameraRowsCache() {
  cameraChannelsCache = {
    rows: null,
    fetchedAt: 0,
  };
}

function clearCameraStatusSnapshotCache() {
  cameraStatusSnapshotCache = {
    data: null,
    fetchedAt: 0,
  };
  cameraStatusSnapshotPromise = null;
}

function parseKeyValuePayload(rawData) {
  const payload = typeof rawData === "string" ? rawData : String(rawData || "");
  const output = {};
  const lines = payload
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

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
  const matches = [
    ...payload.matchAll(/table\.ChannelTitle\[(\d+)\]\.Name=(.*)/g),
  ];

  return matches.reduce((accumulator, entry) => {
    const index = Number(entry[1]);
    if (!Number.isFinite(index)) {
      return accumulator;
    }

    accumulator[index] =
      String(entry[2] || "").trim() || `Channel ${index + 1}`;
    return accumulator;
  }, {});
}

function buildConfigManagerQuery(params) {
  return Object.entries(params || {})
    .filter(
      ([, value]) => value !== undefined && value !== null && value !== "",
    )
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

  const result = Object.entries(groupedByDeviceId)
    .map(([objectId, device]) => {
      const indexedMatch = String(objectId).match(/^indexed_(\d+)$/);
      const parsedIndex = indexedMatch ? Number(indexedMatch[1]) : null;
      const normalized = {
        objectId,
        channelIndex: Number.isFinite(parsedIndex) ? parsedIndex : null,
        ...device,
      };

      const rawAddress = firstNonEmpty(
        normalized.Address,
        normalized.IPAddress,
        normalized.IP,
        normalized.Ip,
        normalized.Host,
        normalized.Domain,
        "",
      );
      const ipPortMatch = String(rawAddress)
        .trim()
        .match(/^([^:]+):(\d+)$/);
      if (ipPortMatch) {
        normalized.Address = firstNonEmpty(normalized.Address, ipPortMatch[1]);
        normalized.IPAddress = firstNonEmpty(
          normalized.IPAddress,
          ipPortMatch[1],
        );
        normalized.IP = firstNonEmpty(normalized.IP, ipPortMatch[1]);
        normalized.Ip = firstNonEmpty(normalized.Ip, ipPortMatch[1]);
        normalized.Port = firstNonEmpty(normalized.Port, ipPortMatch[2]);
      }

      normalized.Username = firstNonEmpty(
        normalized.Username,
        normalized.UserName,
        normalized.Login,
        "",
      );
      normalized.UserName = firstNonEmpty(
        normalized.UserName,
        normalized.Username,
        normalized.Login,
        "",
      );
      normalized.Protocol = firstNonEmpty(
        normalized.Protocol,
        normalized.ProtocolType,
        normalized.TransferProtocol,
        "",
      );
      normalized.ProtocolType = firstNonEmpty(
        normalized.ProtocolType,
        normalized.Protocol,
        normalized.TransferProtocol,
        "",
      );
      return normalized;
    })
    .sort((left, right) => {
      const l = Number.isFinite(left.channelIndex)
        ? left.channelIndex
        : Number.MAX_SAFE_INTEGER;
      const r = Number.isFinite(right.channelIndex)
        ? right.channelIndex
        : Number.MAX_SAFE_INTEGER;
      if (l !== r) {
        return l - r;
      }
      return String(left.objectId || "").localeCompare(
        String(right.objectId || ""),
        undefined,
        { numeric: true },
      );
    });

  return result;
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

function resolveRemoteChannelNo(device, fallbackIndex) {
  const candidates = [
    toNumber(device.RemoteChannelNo),
    toNumber(device.RemoteChannel),
    toNumber(device.ChannelNo),
    toNumber(device.Channel),
    toNumber(device["Channels[0].channel"]),
    toNumber(device["Channels[0].uniqueChannel"]),
    toNumber(device.LogicChannelStart),
  ].filter((value) => value !== null && value > 0);

  if (candidates.length > 0) {
    return String(candidates[0]);
  }

  const localChannel = toNumber(device["assignLocalChannel[0]"]);
  if (localChannel !== null && localChannel >= 0) {
    return String(localChannel + 1);
  }

  return String((Number.isFinite(fallbackIndex) ? fallbackIndex : 0) + 1);
}

function mapRemoteDevicesByChannelIndex(channelTitles, remoteDevices) {
  const sorted = [...(remoteDevices || [])].sort((left, right) => {
    const leftSeq = extractObjectSequence(left.objectId);
    const rightSeq = extractObjectSequence(right.objectId);
    const l = Number.isFinite(leftSeq) ? leftSeq : Number.MAX_SAFE_INTEGER;
    const r = Number.isFinite(rightSeq) ? rightSeq : Number.MAX_SAFE_INTEGER;
    if (l !== r) {
      return l - r;
    }
    return String(left.objectId || "").localeCompare(
      String(right.objectId || ""),
      undefined,
      { numeric: true, sensitivity: "base" },
    );
  });

  const mapping = {};
  const unresolved = [];

  sorted.forEach((device) => {
    const resolvedIndex = Number.isFinite(device?.channelIndex)
      ? Number(device.channelIndex)
      : resolveChannelIndex(device);
    const canUseResolved =
      resolvedIndex !== null && resolvedIndex >= 0 && !mapping[resolvedIndex];

    if (canUseResolved) {
      mapping[resolvedIndex] = device;
      return;
    }

    unresolved.push(device);
  });

  const isDefaultChannelTitle = (title) =>
    /^channel\s*\d+$/i.test(String(title || "").trim());
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
  const defaultFreeIndexes = candidateIndexes.filter(
    (index) => !mapping[index] && !nonDefaultFreeIndexes.includes(index),
  );
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

function parseCameraAllResponse(rawData) {
  const keyValueMap = parseKeyValuePayload(rawData);
  const groupedByCameraIndex = {};

  Object.entries(keyValueMap).forEach(([key, value]) => {
    const match = key.match(/^camera\[(\d+)\]\.(.+)$/i);
    if (!match) {
      return;
    }

    const index = Number(match[1]);
    const field = String(match[2] || "").trim();
    if (!Number.isFinite(index) || !field) {
      return;
    }

    if (!groupedByCameraIndex[index]) {
      groupedByCameraIndex[index] = {
        cameraIndex: index,
      };
    }

    groupedByCameraIndex[index][field] = value;
  });

  return Object.values(groupedByCameraIndex).sort((left, right) => {
    const l = Number.isFinite(left.cameraIndex)
      ? left.cameraIndex
      : Number.MAX_SAFE_INTEGER;
    const r = Number.isFinite(right.cameraIndex)
      ? right.cameraIndex
      : Number.MAX_SAFE_INTEGER;
    if (l !== r) {
      return l - r;
    }
    return String(left.cameraIndex || "").localeCompare(
      String(right.cameraIndex || ""),
      undefined,
      { numeric: true, sensitivity: "base" },
    );
  });
}

function resolveCameraAllStatus(camera) {
  const connectionState = firstNonEmpty(
    camera.ConnectionState,
    camera.State,
    camera.connectionState,
    camera.state,
    camera["DeviceInfo.ConnectionState"],
    camera["DeviceInfo.ConnectState"],
    camera["DeviceInfo.ConnectStatus"],
    camera["DeviceInfo.State"],
    "",
  );

  const normalizedConnection = normalizeOnlineStatus(connectionState);
  if (normalizedConnection !== "unknown") {
    return normalizedConnection;
  }

  if (toBoolean(camera.Enable) || toBoolean(camera["DeviceInfo.Enable"])) {
    return "online";
  }

  return "offline";
}

function resolveCameraAllRemoteChannelNo(camera, fallbackIndex) {
  const candidates = [
    toNumber(camera.UniqueChannel),
    toNumber(camera["DeviceInfo.UniqueChannel"]),
  ].filter((value) => value !== null && value >= 0);

  if (candidates.length > 0) {
    return String(candidates[0] + 1);
  }

  return String((Number.isFinite(fallbackIndex) ? fallbackIndex : 0) + 1);
}

function isRegisteredCamera(camera) {
  return Boolean(
    firstNonEmpty(
      camera.DeviceID,
      camera["DeviceInfo.DeviceID"],
      camera["DeviceInfo.RegID"],
    ),
  );
}

function mapCameraAllToRows(cameraEntries = []) {
  return cameraEntries
    .filter((camera) => isRegisteredCamera(camera))
    .map((camera, index) => {
      const channelNumber = Number(resolveCameraAllRemoteChannelNo(camera, index));
      const status = resolveCameraAllStatus(camera);

      return {
        id: Number.isFinite(channelNumber) ? channelNumber : index + 1,
        name: firstNonEmpty(
          camera["DeviceInfo.Name"],
          camera.Name,
          `Channel ${index + 1}`,
        ),
        channelName: firstNonEmpty(
          camera["DeviceInfo.Name"],
          camera.Name,
          `Channel ${index + 1}`,
        ),
        deviceName: firstNonEmpty(
          camera["DeviceInfo.DeviceType"],
          camera["DeviceInfo.Name"],
          camera.Name,
          "-",
        ),
        ip: firstNonEmpty(
          camera["DeviceInfo.Address"],
          camera["DeviceInfo.IPAddress"],
          camera["DeviceInfo.IP"],
          camera.Address,
          camera.IPAddress,
          camera.IP,
          "-",
        ),
        port: firstNonEmpty(
          camera["DeviceInfo.Port"],
          camera["DeviceInfo.HttpPort"],
          camera["DeviceInfo.RtspPort"],
          camera.Port,
          "37777",
        ),
        status,
        statusMessage: resolveStatusMessage(camera, status),
        record: toBoolean(camera.Enable ?? camera["DeviceInfo.Enable"]),
        registrationNo: firstNonEmpty(
          camera["DeviceInfo.RegID"],
          camera.RegID,
          "--",
        ),
        username: firstNonEmpty(
          camera.UserName,
          camera.Username,
          camera["DeviceInfo.UserName"],
          camera["DeviceInfo.Username"],
          "admin",
        ),
        passwordMasked: firstNonEmpty(
          camera.Password,
          camera.PassWord,
          camera["DeviceInfo.Password"],
          camera["DeviceInfo.PassWord"],
          "",
        )
          ? "******"
          : "******",
        manufacture: firstNonEmpty(
          camera["DeviceInfo.ProtocolType"],
          camera["DeviceInfo.Vendor"],
          camera.Vendor,
          camera.ProtocolType,
          "Dahua",
        ),
        model: firstNonEmpty(
          camera["DeviceInfo.DeviceType"],
          camera["DeviceInfo.Model"],
          camera.DeviceType,
          camera.Model,
          "--",
        ),
        sn: firstNonEmpty(
          camera["DeviceInfo.SerialNo"],
          camera.SerialNo,
          camera.SN,
          "--",
        ),
        remoteChannelNo: firstNonEmpty(
          camera["DeviceInfo.VideoInputChannels"],
          camera.RemoteChannelNo,
          "--",

        )
      };
    })
    .filter(Boolean);
}

function delay(ms = 0) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  if (
    [
      "1",
      "true",
      "online",
      "connect",
      "connected",
      "up",
      "ok",
      "normal",
      "alive",
      "enable",
      "enabled",
      "active",
    ].includes(normalized)
  ) {
    return "online";
  }
  if (
    [
      "0",
      "false",
      "offline",
      "disconnect",
      "disconnected",
      "down",
      "error",
      "failed",
      "fail",
      "timeout",
      "disable",
      "disabled",
      "inactive",
    ].includes(normalized)
  ) {
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

function resolveCameraStatus(
  remote,
  { record, hasConfiguredRemote, remoteChannelNumber, hasDeviceIdentity },
) {
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

  // If device is configured (has IP, port, credentials), treat as online
  // even if connection temporarily failed. This allows users to see configured
  // cameras even during temporary network issues.
  if (hasConfiguredRemote) {
    return "online";
  }

  return "unknown";
}

function normalizeRecordFlag(value) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  return ["1", "true", "on", "enabled", "recording"].includes(normalized);
}

function normalizeBooleanLike(value) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  if (
    [
      "1",
      "true",
      "yes",
      "on",
      "online",
      "connected",
      "connect",
      "active",
      "ok",
    ].includes(normalized)
  ) {
    return true;
  }
  if (
    [
      "0",
      "false",
      "no",
      "off",
      "offline",
      "loss",
      "lost",
      "disconnected",
      "disconnect",
      "failed",
      "error",
      "inactive",
    ].includes(normalized)
  ) {
    return false;
  }
  return null;
}

function extractVideoSignalStatus(rawData) {
  const payload = parseKeyValuePayload(rawData);
  const signalValue = firstNonEmpty(
    payload.videoSignal,
    payload.VideoSignal,
    payload.videoStatus,
    payload.VideoStatus,
    payload.signal,
    payload.Signal,
    payload.status,
    payload.Status,
    "",
  );
  const lossValue = firstNonEmpty(
    payload.videoLoss,
    payload.VideoLoss,
    payload.loss,
    payload.Loss,
    "",
  );

  const signalFlag = normalizeBooleanLike(signalValue);
  const lossFlag = normalizeBooleanLike(lossValue);

  if (signalFlag === true || lossFlag === false) {
    return "online";
  }

  if (signalFlag === false || lossFlag === true) {
    return "offline";
  }

  return "unknown";
}

function extractRecordStatus(rawData) {
  const payload = parseKeyValuePayload(rawData);
  const statusValue = firstNonEmpty(
    payload.status,
    payload.Status,
    payload.recordStatus,
    payload.RecordStatus,
    payload.record,
    payload.Record,
    payload.recording,
    payload.Recording,
    "",
  );
  const normalized = normalizeBooleanLike(statusValue);
  if (normalized !== null) {
    return normalized;
  }

  const trimmed = String(statusValue || "").trim();
  if (trimmed === "1") {
    return true;
  }
  if (trimmed === "0") {
    return false;
  }

  return null;
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
  return Boolean(
    firstNonEmpty(
      remote.Address,
      remote.IPAddress,
      remote.IP,
      remote.Name,
      remote.DeviceID,
      remote.Protocol,
      remote.ProtocolType,
      remote.SerialNo,
      remote.SN,
    ),
  );
}

function hasDeviceIdentity(remote) {
  return Boolean(
    firstNonEmpty(remote.Model, remote.DeviceModel, remote.SerialNo, remote.SN),
  );
}

function toCameraRows(
  channelTitles,
  remoteDevicesByIndex,
  statusProbeByIndex = {},
) {
  const indexes = Object.keys(remoteDevicesByIndex)
    .map(Number)
    .filter((index) => Number.isFinite(index))
    .sort((a, b) => a - b);

  return indexes
    .map((index) => {
      const remote = remoteDevicesByIndex[index];
      const probe = statusProbeByIndex[index] || {};

      if (!remote) {
        return null;
      }

      const channelName = firstNonEmpty(
        channelTitles[index],
        remote.Name,
        `Channel ${index + 1}`,
      );

      return {
        id: index + 1,
        name: channelName,
        channelName,
        deviceName: firstNonEmpty(remote.Name, remote.SerialNo, "-"),
        ip: firstNonEmpty(remote.Address, remote.IPAddress, remote.IP, remote.Ip, "-"),
        port: firstNonEmpty(remote.Port, remote.HttpPort, remote.RtspPort, "37777"),
        status: probe.status || "offline",
        statusMessage: probe.status === "offline" ? "Status probe failed or disconnected." : "",
        record: Boolean(probe.record),
        registrationNo: firstNonEmpty(remote.DeviceID, remote.RegID, "--"),
        username: firstNonEmpty(remote.UserName, remote.Username, "admin"),
        // passwordMasked: firstNonEmpty(remote.Password, remote.PassWord, "") ? "******" : "--",
        passwordMasked: "******",
        manufacture: firstNonEmpty(remote.Vendor, remote.Manufacturer, remote.ManuFacturer, remote.ProtocolType, remote.Protocol, "Dahua"),
        model: firstNonEmpty(remote.DeviceType, remote.Model, remote.DeviceModel, "--"),
        sn: firstNonEmpty(remote.SerialNo, remote.SN, "--"),
        remoteChannelNo: resolveRemoteChannelNo(remote, index),
      };
    })
    .filter(Boolean);
}

function flattenObjectToDotNotation(input, prefix = "", output = {}) {
  if (input === null || input === undefined) {
    return output;
  }

  if (Array.isArray(input)) {
    input.forEach((value, index) => {
      const nextPrefix = prefix ? `${prefix}[${index}]` : `[${index}]`;
      flattenObjectToDotNotation(value, nextPrefix, output);
    });
    return output;
  }

  if (typeof input !== "object") {
    if (prefix) {
      output[prefix] = input;
    }
    return output;
  }

  Object.entries(input).forEach(([key, value]) => {
    const nextPrefix = prefix ? `${prefix}.${key}` : key;
    flattenObjectToDotNotation(value, nextPrefix, output);
  });

  return output;
}

function normalizeJsonConfigObject(rawData) {
  if (!rawData || typeof rawData !== "object" || Array.isArray(rawData)) {
    return null;
  }

  return flattenObjectToDotNotation(rawData);
}

function normalizeConfigKey(key) {
  return String(key || "").replace(/^table\./i, "");
}

function normalizeKeyValueMap(rawMap = {}) {
  return Object.entries(rawMap).reduce((accumulator, [key, value]) => {
    accumulator[normalizeConfigKey(key)] = value;
    return accumulator;
  }, {});
}

function toBoolean(value) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  return ["1", "true", "on", "enable", "enabled", "yes"].includes(normalized);
}

function normalizeConnectionState(value) {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();

  if (["connected", "connecting", "connect", "online", "ok", "active"].includes(normalized)) {
    return "online";
  }

  if (["unconnect", "unconnected", "disconnect", "disconnected", "offline", "empty", "failed", "error", "loss", "lost", "inactive"].includes(normalized)) {
    return "offline";
  }

  return "unknown";
}

function normalizeDahuaConfigMap(rawData) {
  if (rawData && typeof rawData === "object" && !Array.isArray(rawData)) {
    const jsonMap = normalizeJsonConfigObject(rawData);
    if (jsonMap && Object.keys(jsonMap).length > 0) {
      return normalizeKeyValueMap(jsonMap);
    }
  }

  return normalizeKeyValueMap(parseKeyValuePayload(rawData));
}

function normalizeCameraStateValue(rawState) {
  const connectionState = String(
    rawState?.connectionState
    ?? rawState?.ConnectionState
    ?? rawState?.connectState
    ?? rawState?.ConnectState
    ?? rawState?.state
    ?? rawState?.State
    ?? "",
  ).trim();
  const capState = toBoolean(
    rawState?.capState
    ?? rawState?.CapState
    ?? rawState?.cap
    ?? rawState?.Cap
    ?? false,
  );
  const errorMessage = String(
    rawState?.errorMessage
    ?? rawState?.ErrorMessage
    ?? rawState?.message
    ?? rawState?.Message
    ?? "",
  ).trim();

  const normalizedConnection = normalizeConnectionState(connectionState);
  const online = normalizedConnection === "online" || capState === true;
  const offline = normalizedConnection === "offline" || (capState === false && normalizedConnection !== "online") || Boolean(errorMessage);

  return {
    connectionState,
    capState,
    errorMessage,
    online: online && !offline ? true : false,
    raw: rawState,
  };
}

function parseCameraStateResponse(rawData, channelId = 1) {
  const payload = rawData && typeof rawData === "object" && !Array.isArray(rawData)
    ? rawData
    : normalizeDahuaConfigMap(rawData);

  const states = Array.isArray(payload?.states)
    ? payload.states
    : Array.isArray(payload?.state)
      ? payload.state
      : [];
  const targetChannel = Number(channelId);
  const fallbackChannel = Number.isFinite(targetChannel) ? Math.max(targetChannel - 1, 0) : 0;

  const matchedState = states.find((state, index) => {
    const stateChannel = Number(
      state?.channel
      ?? state?.Channel
      ?? state?.chan
      ?? state?.Chan
      ?? index,
    );
    if (!Number.isFinite(stateChannel)) {
      return false;
    }

    return stateChannel === targetChannel || stateChannel === fallbackChannel;
  }) || states[fallbackChannel] || states[0] || null;

  if (!matchedState) {
    return {
      channelId: targetChannel,
      online: false,
      connectionState: "unknown",
      capState: false,
      errorMessage: "",
      raw: payload,
    };
  }

  const normalized = normalizeCameraStateValue(matchedState);
  return {
    channelId: targetChannel,
    channel: Number(
      matchedState?.channel
      ?? matchedState?.Channel
      ?? matchedState?.chan
      ?? matchedState?.Chan
      ?? targetChannel,
    ),
    ...normalized,
    raw: payload,
  };
}

function parseRecordStateAllResponse(rawData, channelId = 1) {
  const payload = rawData && typeof rawData === "object" && !Array.isArray(rawData)
    ? rawData
    : normalizeDahuaConfigMap(rawData);
  const states = Array.isArray(payload?.states)
    ? payload.states
    : Array.isArray(payload?.state)
      ? payload.state
      : [];
  const targetChannel = Number(channelId);
  const fallbackChannel = Number.isFinite(targetChannel) ? Math.max(targetChannel - 1, 0) : 0;
  const selectedState = states.find((state, index) => {
    const stateChannel = Number(
      state?.channel
      ?? state?.Channel
      ?? state?.chan
      ?? state?.Chan
      ?? index,
    );
    if (!Number.isFinite(stateChannel)) {
      return false;
    }

    return stateChannel === targetChannel || stateChannel === fallbackChannel;
  }) || states[fallbackChannel] || states[0] || payload?.state || payload?.State || null;
  const mainState = selectedState?.Main
    ?? selectedState?.main
    ?? selectedState?.state?.Main
    ?? selectedState?.state?.main
    ?? null;

  const statusValue = String(
    mainState?.State
    ?? mainState?.state
    ?? mainState?.status
    ?? selectedState?.Main?.State
    ?? selectedState?.main?.State
    ?? selectedState?.State
    ?? selectedState?.status
    ?? payload?.Main?.State
    ?? payload?.State
    ?? payload?.status
    ?? "",
  ).trim();

  const normalizedStatus = statusValue.toLowerCase();
  const record = normalizeRecordFlag(statusValue)
    || statusValue === "1"
    || normalizedStatus === "on"
    || normalizedStatus === "true";

  return {
    record,
    mainState: mainState || selectedState?.Main || null,
    selectedState,
    raw: payload,
  };
}

async function fetchCameraStatusSnapshot() {
  if (cameraStatusSnapshotCache.data) {
    return cameraStatusSnapshotCache.data;
  }

  if (cameraStatusSnapshotPromise) {
    return cameraStatusSnapshotPromise;
  }

  cameraStatusSnapshotPromise = (async () => {
    const videoEndpoint = `/cgi-bin/api/LogicDeviceManager/getCameraState`;
    const recordEndpoint = `/cgi-bin/api/recordManager/getStateAll`;

    const readProbeEndpoint = async (endpoint, body) => {
      try {
        const response = await ApiClient.post(endpoint, body, {
          headers: {
            "Cache-Control": "no-cache, no-store",
            Pragma: "no-cache",
          },
        });
        return {
          data: response?.data,
          error: null,
        };
      } catch (error) {
        return {
          data: null,
          error,
        };
      }
    };

    const [videoResult, recordResult] = await Promise.all([
      readProbeEndpoint(videoEndpoint, { uniqueChannels: [-1] }),
      readProbeEndpoint(recordEndpoint, {}),
    ]);

    const snapshot = {
      videoData: videoResult.data,
      recordData: recordResult.data,
      videoError: videoResult.error,
      recordError: recordResult.error,
      fetchedAt: Date.now(),
    };

    cameraStatusSnapshotCache = {
      data: snapshot,
      fetchedAt: snapshot.fetchedAt,
    };

    return snapshot;
  })();

  try {
    return await cameraStatusSnapshotPromise;
  } finally {
    cameraStatusSnapshotPromise = null;
  }
}

// get status kamera
async function getCameraStatusProbe(channelId = 1) {
  const cleanId = parseInt(String(channelId).replace(/\D/g, ""), 10) || 1;
  try {
    const snapshot = await fetchCameraStatusSnapshot();
    const videoData = snapshot.videoData;
    const recordData = snapshot.recordData;
    const videoError = snapshot.videoError;
    const recordError = snapshot.recordError;

    const cameraState = videoData !== null
      ? parseCameraStateResponse(videoData, cleanId)
      : {
          channelId: cleanId,
          online: false,
          connectionState: "unknown",
          capState: false,
          errorMessage: "",
          raw: null,
        };
    const recordState = recordData !== null
      ? parseRecordStateAllResponse(recordData, cleanId)
      : {
          record: null,
          mainState: null,
          selectedState: null,
          raw: null,
        };
    const videoSignal = cameraState.online ? "online" : "offline";
    const record = recordState.record;
    const unauthorized = [videoError, recordError].some((error) => Number(error?.response?.status || 0) === 401);
    const authRetried = Boolean(videoError?.config?.__digestRetryCount || recordError?.config?.__digestRetryCount || 0);

    return {
      channelId: cleanId,
      videoSignal,
      record,
      cameraState,
      recordState,
      authRetried,
      unauthorized,
    };
  } catch (error) {
    const status = Number(error?.response?.status || 0);
    console.error("[getCameraStatusProbe] error", {
      channelId: cleanId,
      status,
      message: error?.message,
      data: error?.response?.data,
    });
    return {
      channelId: cleanId,
      videoSignal: "unknown",
      record: null,
      cameraState: null,
      recordState: null,
      unauthorized: status === 401,
      authRetried: Boolean(error?.config?.__digestRetryCount || 0),
    };
  }
}

function normalizeAddChannelNumber(channelIndex) {
  const parsed = Number(channelIndex);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return 1;
  }

  return Math.floor(parsed);
}

function buildAddCameraRequest({
  channelNumber,
  ipAddress,
  port = "37777",
  username = "admin",
  password = "admin123",
  protocol = "Private",
}) {
  const resolvedChannelNumber = normalizeAddChannelNumber(channelNumber);

  return {
    group: {},
    uniqueChannel: resolvedChannelNumber,
    addDevice: {
      device: {
        DeviceName: firstNonEmpty(ipAddress, `Camera ${resolvedChannelNumber}`),
        ProtocolType: protocol,
        Port: Number(port) || 37777,
        Username: username,
        Password: password,
        IpAddress: ipAddress,
        Address: ipAddress,
        ChannelNum: resolvedChannelNumber,
      },
    },
  };
}

async function postAddCameraRequest(payload) {
  const response = await ApiClient.post(
    "/cgi-bin/configManager.cgi?action=setConfig",
    payload,
    {
      headers: {
        "Content-Type": "application/json",
      },
    },
  );

  return response?.data;
}

export const cameraService = {
  getCameraStatusProbe,

  getCameraChannels: async () => {
    const cachedRows = getCachedCameraRows();
    if (cachedRows) {
      return cachedRows;
    }

    if (cameraChannelsInFlightPromise) {
      return cameraChannelsInFlightPromise;
    }

    cameraChannelsInFlightPromise = (async () => {
    // Step 1: Warmup Digest Auth
    await warmupDigestChallenge();

    // Step 2: Sequential API calls - ChannelTitle first
    const fetchConfigWithRetry = async (path, label) => {
      try {
        const response = await ApiClient.get(path);
        return response;
      } catch (firstError) {
        const firstStatus = Number(firstError?.response?.status || 0);
        const shouldRetry = firstStatus === 401 || firstStatus === 501;
        console.error(`[cameraService] ${label} rejected (first):`, {
          status: firstStatus,
          message: firstError?.message,
        });

        if (!shouldRetry) {
          return { __error: firstError };
        }

        await delay(1000);
        await warmupDigestChallenge().catch(() => null);
        await delay(500);

        try {
          const retried = await ApiClient.get(path);
          return retried;
        } catch (secondError) {
          console.error(`[cameraService] ${label} rejected (retry):`, {
            status: Number(secondError?.response?.status || 0),
            message: secondError?.message,
          });
          return { __error: secondError };
        }
      }
    };

    // Fetch ChannelTitle and CameraAll in parallel to reduce latency
    const [channelTitleResult, cameraAllResult] = await Promise.all([
      fetchConfigWithRetry(
        "/cgi-bin/configManager.cgi?action=getConfig&name=ChannelTitle",
        "ChannelTitle",
      ),
      fetchConfigWithRetry(
        "/cgi-bin/LogicDeviceManager.cgi?action=getCameraAll",
        "CameraAll",
      ),
    ]);

    const channelTitleFulfilled = !channelTitleResult?.__error;
    const cameraAllFulfilled = !cameraAllResult?.__error;

    const channelTitles = channelTitleFulfilled
      ? parseChannelTitles(channelTitleResult?.data)
      : {};

    const parsedCameraEntries = cameraAllFulfilled
      ? parseCameraAllResponse(cameraAllResult?.data)
      : [];

    if (!channelTitleFulfilled && !cameraAllFulfilled) {
      const error = channelTitleResult?.__error || cameraAllResult?.__error;
      console.error("[cameraService] Both requests failed:", error);
      throw error;
    }

    const cameraRows = mapCameraAllToRows(parsedCameraEntries);
    const probeIndexes = Array.from(
      new Set(cameraRows.map((row) => Number(row.id))),
    )
      .filter((index) => Number.isFinite(index))
      .sort((a, b) => a - b);

    // Run probes in parallel (snapshot already fetched inside getCameraStatusProbe)
    const statusProbeByIndex = {};
    const probePromises = probeIndexes.map(async (index) => {
      try {
        const probe = await getCameraStatusProbe(index);
        const rawConnectionState = String(
          probe?.cameraState?.connectionState
          ?? probe?.cameraState?.ConnectionState
          ?? probe?.videoSignal
          ?? "",
        ).trim();
        const normalizedStatus = normalizeOnlineStatus(rawConnectionState);
        const recordRawValue =
          probe?.recordState?.selectedState?.Main?.State
          ?? probe?.recordState?.selectedState?.main?.State
          ?? probe?.recordState?.mainState?.State
          ?? probe?.record;
        const normalizedRecord =
          recordRawValue === true
          || recordRawValue === 1
          || String(recordRawValue).trim().toLowerCase() === "true"
          || String(recordRawValue).trim() === "1";

        return [index, {
          status: normalizedStatus === "unknown"
            ? (rawConnectionState.toLowerCase() === "connecting" ? "unknown" : "offline")
            : normalizedStatus,
          record: normalizedRecord,
        }];
      } catch {
        return [index, { status: "offline", record: false }];
      }
    });

    const probeResults = await Promise.all(probePromises);
    probeResults.forEach(([idx, value]) => {
      statusProbeByIndex[idx] = value;
    });

    const rows = cameraRows.map((row) => {
      const probe = statusProbeByIndex[row.id] || {};
      return {
        ...row,
        status: probe.status || row.status,
        record: typeof probe.record === "boolean" ? probe.record : row.record,
      };
    });

    updateCameraRowsCache(rows);
    return rows;
    })();

    try {
      return await cameraChannelsInFlightPromise;
    } finally {
      cameraChannelsInFlightPromise = null;
    }
  },

  addRemoteDevice: async ({
    channelIndex = 0,
    ipAddress,
    port = "37777",
    username = "admin",
    password = "admin123",
    protocol = "Private",
  }) => {
    clearCameraRowsCache();
    const query = buildConfigManagerQuery({
      action: "setConfig",
      [`RemoteDevice[${channelIndex}].Address`]: ipAddress,
      [`RemoteDevice[${channelIndex}].Port`]: port,
      [`RemoteDevice[${channelIndex}].Username`]: username,
      [`RemoteDevice[${channelIndex}].Password`]: password,
      [`RemoteDevice[${channelIndex}].Protocol`]: protocol,
    });

    const response = await ApiClient.get(`/cgi-bin/configManager.cgi?${query}`);
    clearCameraRowsCache();
    clearCameraStatusSnapshotCache();
    return response?.data;
  },
};


