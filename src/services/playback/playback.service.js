import ApiClient from "../../lib/api";
import { authStore } from "../../stores/authSlice";

function formatPlaybackTimestamp(value) {
    if (!value) {
        return "";
    }

    const parsedDate = new Date(value);
    if (Number.isNaN(parsedDate.getTime())) {
        return "";
    }

    const year = String(parsedDate.getFullYear());
    const month = String(parsedDate.getMonth() + 1).padStart(2, "0");
    const day = String(parsedDate.getDate()).padStart(2, "0");
    const hour = String(parsedDate.getHours()).padStart(2, "0");
    const minute = String(parsedDate.getMinutes()).padStart(2, "0");
    const second = String(parsedDate.getSeconds()).padStart(2, "0");

    return `${year}_${month}_${day}_${hour}_${minute}_${second}`;
}

function formatPlaybackTimestampUtc(value) {
    if (!value) {
        return "";
    }

    const parsedDate = new Date(value);
    if (Number.isNaN(parsedDate.getTime())) {
        return "";
    }

    const year = String(parsedDate.getUTCFullYear());
    const month = String(parsedDate.getUTCMonth() + 1).padStart(2, "0");
    const day = String(parsedDate.getUTCDate()).padStart(2, "0");
    const hour = String(parsedDate.getUTCHours()).padStart(2, "0");
    const minute = String(parsedDate.getUTCMinutes()).padStart(2, "0");
    const second = String(parsedDate.getUTCSeconds()).padStart(2, "0");

    return `${year}_${month}_${day}_${hour}_${minute}_${second}`;
}

const streamRegistrationCache = new Map();
const inFlightRegistration = new Map();
const failedRegistrationCooldown = new Map();
const REGISTER_RETRY_COOLDOWN_MS = 10000;

function getCameraHost() {
    const rtspHost = String(import.meta.env.VITE_RTSP_HOST || "").trim();
    if (rtspHost) {
        try {
            return new URL(rtspHost).hostname;
        } catch {
            return rtspHost;
        }
    }

    const cameraHttp = String(import.meta.env.VITE_CAMERA_URL || "").trim();
    if (cameraHttp) {
        try {
            return new URL(cameraHttp).hostname;
        } catch {
            return cameraHttp;
        }
    }

    return window.location.hostname || "127.0.0.1";
}

function applyTemplate(template, map) {
    if (!template) {
        return "";
    }

    return Object.entries(map).reduce((output, [key, value]) => {
        return output.replaceAll(`{${key}}`, String(value ?? ""));
    }, String(template));
}

function getGo2rtcBaseUrl() {
    const raw = String(import.meta.env.VITE_HLS_GATEWAY_URL || "").trim();
    if (!raw) {
        return "";
    }

    try {
        const parsed = new URL(raw, window.location.origin);
        return parsed.origin;
    } catch {
        return "";
    }
}

function toGo2rtcUrl(urlOrPath) {
    const value = String(urlOrPath || "").trim();
    if (!value) {
        return "";
    }

    if (/^https?:\/\//i.test(value)) {
        return value;
    }

    const base = getGo2rtcBaseUrl();
    if (!base) {
        return value;
    }

    const normalizedPath = value
        .replace(/^\/go2rtc(?=\/|$)/i, "")
        .replace(/^go2rtc(?=\/|$)/i, "");

    try {
        return new URL(normalizedPath || value, base).toString();
    } catch {
        return value;
    }
}

function sanitizeNamePart(value) {
    return String(value ?? "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 64);
}

function normalizeCredential(value) {
    const raw = String(value ?? "").trim();
    if (!raw) {
        return "";
    }

    const withoutQuotes = raw.replace(/^['"]|['"]$/g, "");
    try {
        return decodeURIComponent(withoutQuotes);
    } catch {
        return withoutQuotes;
    }
}

function encodeUserInfo(value) {
    return encodeURIComponent(String(value ?? ""))
        .replace(/[!'()*]/g, (character) => {
            return `%${character.charCodeAt(0).toString(16).toUpperCase()}`;
        });
}

function getActiveRtspCredentials() {
    const authState = authStore.getState();
    const sessionUsername = normalizeCredential(authState?.auth?.username || "");
    const sessionPassword = normalizeCredential(authState?.runtimeRtspPassword || "");
    const envUsername = normalizeCredential(import.meta.env.VITE_RTSP_USERNAME || "");
    const envPassword = normalizeCredential(import.meta.env.VITE_RTSP_PASSWORD || "");

    return {
        username: sessionUsername || envUsername,
        password: sessionPassword || envPassword,
    };
}

function assertRtspCredentials(credentials) {
    const username = normalizeCredential(credentials?.username || "");
    const password = normalizeCredential(credentials?.password || "");
    if (!username || !password) {
        throw new Error("Kredensial RTSP belum siap. Silakan login ulang agar user/password RTSP sinkron dengan sesi aktif.");
    }
}

function applyRtspCredentials(urlValue, credentials = {}) {
    const raw = String(urlValue || "").trim();
    if (!raw) {
        return "";
    }

    try {
        const parsed = new URL(raw);
        const username = normalizeCredential(credentials.username || "");
        const password = normalizeCredential(credentials.password || "");
        parsed.username = username;
        parsed.password = password;
        return parsed.toString();
    } catch {
        return raw;
    }
}

function buildRtspUrl(pathname, params) {
    const host = getCameraHost();
    const port = import.meta.env.VITE_RTSP_PORT || "554";
    const activeCredentials = getActiveRtspCredentials();
    assertRtspCredentials(activeCredentials);
    const username = normalizeCredential(activeCredentials.username || "");
    const password = normalizeCredential(activeCredentials.password || "");

    const credentials = username
        ? `${encodeUserInfo(username)}${password ? `:${encodeUserInfo(password)}` : ""}@`
        : "";

    const url = new URL(`rtsp://${credentials}${host}:${port}${pathname}`);

    Object.entries(params || {}).forEach(([key, value]) => {
        if (value === undefined || value === null || value === "") {
            return;
        }

        url.searchParams.set(key, String(value));
    });

    return url.toString();
}

function uniqueValues(values) {
    return Array.from(new Set((values || []).map((value) => String(value ?? ""))));
}

function normalizeRtspPath(value) {
    const raw = String(value || "").trim();
    if (!raw) {
        return "";
    }
    if (raw.startsWith("/")) {
        return raw;
    }
    return `/${raw}`;
}

function parseExtraRtspQuery(envKey) {
    const raw = String(import.meta.env[envKey] || "").trim();
    if (!raw) {
        return {};
    }

    const query = {};
    const pairs = raw.split("&").map((part) => part.trim()).filter(Boolean);
    pairs.forEach((pair) => {
        const [key, value = ""] = pair.split("=");
        if (!key) {
            return;
        }
        query[decodeURIComponent(key)] = decodeURIComponent(value);
    });

    return query;
}

function envFlagEnabled(envKey, defaultValue = false) {
    const raw = String(import.meta.env[envKey] ?? "").trim().toLowerCase();
    if (!raw) {
        return defaultValue;
    }
    return ["1", "true", "yes", "on"].includes(raw);
}

function buildFromTemplate(template, map) {
    if (!template) {
        return "";
    }
    return Object.entries(map).reduce((output, [key, value]) => {
        return output.replaceAll(`{${key}}`, String(value ?? ""));
    }, String(template));
}

function buildPlaybackPlayerUrl({ channel, streamName = "" }) {
    const template = import.meta.env.VITE_GO2RTC_PLAYBACK_PLAYER_TEMPLATE || "/go2rtc/stream.html?src={streamEncoded}&mode=mse";
    const stream = sanitizeNamePart(streamName || `playback-ch${channel}`) || "playback-ch1";
    const resolved = applyTemplate(template, {
        channel,
        stream,
        streamEncoded: encodeURIComponent(stream),
    });
    return toGo2rtcUrl(resolved);
}

function buildPlaybackHlsUrl({ channel, starttime, endtime, rtspUrl = "", streamName = "" }) {
    const template = import.meta.env.VITE_HLS_PLAYBACK_TEMPLATE || "";
    const stream = sanitizeNamePart(streamName || `playback-ch${channel}`) || "playback-ch1";
    return applyTemplate(template, {
        channel,
        starttime,
        endtime,
        stream,
        streamEncoded: encodeURIComponent(stream),
        rtsp: rtspUrl,
        rtspEncoded: encodeURIComponent(rtspUrl),
    });
}

async function probeHlsPlaylist(url) {
    const response = await fetch(url, {
        method: "GET",
        cache: "no-store",
        headers: {
            "Cache-Control": "no-cache, no-store",
            Pragma: "no-cache",
        },
    });

    if (!response.ok) {
        return false;
    }

    const contentType = String(response.headers.get("content-type") || "").toLowerCase();
    if (contentType.includes("application/vnd.apple.mpegurl")) {
        return true;
    }

    const body = await response.text().catch(() => "");
    return body.includes("#EXTM3U");
}

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

function toDahuaDateTime(value) {
    const parsedDate = new Date(value);
    if (Number.isNaN(parsedDate.getTime())) {
        return "";
    }

    const year = String(parsedDate.getFullYear()).padStart(4, "0");
    const month = String(parsedDate.getMonth() + 1).padStart(2, "0");
    const day = String(parsedDate.getDate()).padStart(2, "0");
    const hour = String(parsedDate.getHours()).padStart(2, "0");
    const minute = String(parsedDate.getMinutes()).padStart(2, "0");
    const second = String(parsedDate.getSeconds()).padStart(2, "0");

    return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
}

function parseRecordingRows(rawData) {
    const keyValues = parseKeyValuePayload(rawData);
    const buckets = {};

    Object.entries(keyValues).forEach(([key, value]) => {
        const match = key.match(/^items\[(\d+)\]\.(.+)$/);
        if (!match) {
            return;
        }

        const index = Number(match[1]);
        if (!Number.isFinite(index)) {
            return;
        }

        const field = String(match[2] || "").trim();
        if (!field) {
            return;
        }

        if (!buckets[index]) {
            buckets[index] = {};
        }
        buckets[index][field] = value;
    });

    return Object.values(buckets)
        .map((entry) => ({
            beginTime: String(entry.BeginTime || entry.StartTime || "").trim(),
            endTime: String(entry.EndTime || "").trim(),
            filePath: String(entry.FilePath || entry.FileName || "").trim(),
            type: String(entry.Type || entry.Stream || entry.Flags || "").trim(),
        }))
        .filter((entry) => entry.beginTime && entry.endTime)
        .sort((left, right) => left.beginTime.localeCompare(right.beginTime));
}

function buildQueryString(params) {
    return Object.entries(params || {})
        .filter(([, value]) => value !== undefined && value !== null && value !== "")
        .map(([key, value]) => `${key}=${encodeURIComponent(String(value))}`)
        .join("&");
}

function toDahuaVideoStream(subtype) {
    if (String(subtype) === "1") {
        return "Extra1";
    }
    return "Main";
}

export const playbackService = {
    formatPlaybackTimestamp,
    ensureGo2rtcStream: async ({ streamName, rtspUrl }) => {
        if (!streamName || !rtspUrl) {
            return;
        }

        const cached = streamRegistrationCache.get(streamName);
        if (cached === rtspUrl) {
            return;
        }

        const inFlightKey = `${streamName}::${rtspUrl}`;
        const now = Date.now();
        const retryAfter = Number(failedRegistrationCooldown.get(inFlightKey) || 0);
        if (retryAfter > now) {
            const waitSeconds = Math.ceil((retryAfter - now) / 1000);
            throw new Error(`Registrasi stream ditunda sementara untuk mencegah lockout. Coba lagi ${waitSeconds} detik lagi.`);
        }

        if (inFlightRegistration.has(inFlightKey)) {
            return inFlightRegistration.get(inFlightKey);
        }

        const registerPath = import.meta.env.VITE_GO2RTC_STREAM_REGISTER_PATH || "/go2rtc/api/streams";
        const registerUrl = new URL(registerPath, window.location.origin);
        registerUrl.searchParams.set("name", streamName);
        registerUrl.searchParams.set("src", rtspUrl);

        const requestPromise = fetch(registerUrl.toString(), {
            method: "PUT",
        })
            .then(async (response) => {
                if (!response.ok) {
                    const detail = await response.text().catch(() => "");
                    failedRegistrationCooldown.set(inFlightKey, Date.now() + REGISTER_RETRY_COOLDOWN_MS);
                    throw new Error(detail || `Register stream gagal (${response.status})`);
                }

                streamRegistrationCache.set(streamName, rtspUrl);
                failedRegistrationCooldown.delete(inFlightKey);
            })
            .finally(() => {
                inFlightRegistration.delete(inFlightKey);
            });

        inFlightRegistration.set(inFlightKey, requestPromise);
        return requestPromise;
    },
    waitForHlsReady: async ({ hlsUrl, timeoutMs = 7000, intervalMs = 400 }) => {
        if (!hlsUrl) {
            return false;
        }

        const timeout = Number(timeoutMs);
        const interval = Number(intervalMs);
        const maxTimeout = Number.isFinite(timeout) && timeout > 0 ? timeout : 7000;
        const pollInterval = Number.isFinite(interval) && interval > 0 ? interval : 400;
        const startedAt = Date.now();

        while (Date.now() - startedAt <= maxTimeout) {
            try {
                const ready = await probeHlsPlaylist(hlsUrl);
                if (ready) {
                    return true;
                }
            } catch {
                // Ignore probe errors while stream is warming up.
            }

            await new Promise((resolve) => {
                setTimeout(resolve, pollInterval);
            });
        }

        return false;
    },
    buildPlaybackStreamSources: ({ channel, subtype = 0, starttime, endtime }) => {
        const playbackTemplate = String(import.meta.env.VITE_RTSP_PLAYBACK_URL_TEMPLATE || "").trim();
        const activeCredentials = getActiveRtspCredentials();
        assertRtspCredentials(activeCredentials);
        const forceMainStream = envFlagEnabled("VITE_PLAYBACK_FORCE_MAIN_STREAM", false);
        const includeUtcParams = envFlagEnabled("VITE_PLAYBACK_INCLUDE_UTC_PARAMS", false);
        const includeUnicastParam = envFlagEnabled("VITE_PLAYBACK_INCLUDE_UNICAST_PARAM", false);
        const includeSubtypeOnCamPlayback = envFlagEnabled("VITE_PLAYBACK_INCLUDE_SUBTYPE_ON_CAM_PLAYBACK", false);
        const configuredPlaybackPaths = String(import.meta.env.VITE_RTSP_PLAYBACK_PATHS || "").trim();
        const requestedSubtype = Number(subtype);
        const safeRequestedSubtype = Number.isFinite(requestedSubtype) ? requestedSubtype : 0;
        const resolvedSubtype = forceMainStream ? 0 : safeRequestedSubtype;
        const playbackExtraQuery = {
            ...(includeUnicastParam ? { unicast: "true" } : {}),
            ...parseExtraRtspQuery("VITE_RTSP_PLAYBACK_EXTRA_QUERY"),
        };
        const formattedStart = formatPlaybackTimestamp(starttime);
        const formattedEnd = formatPlaybackTimestamp(endtime);
        const formattedStartUtc = formatPlaybackTimestampUtc(starttime);
        const formattedEndUtc = formatPlaybackTimestampUtc(endtime);

        const streamName = sanitizeNamePart(
            `playback-ch${channel}-${formattedStart}-${formattedEnd}-s${resolvedSubtype}`,
        ) || "playback-ch1";

        const query = {
            channel,
            starttime: formattedStart,
            endtime: formattedEnd,
            ...(includeUtcParams ? {
                starttimeRealUTC: formattedStartUtc,
                endtimeRealUTC: formattedEndUtc,
            } : {}),
            subtype: resolvedSubtype,
            ...playbackExtraQuery,
        };

        const subtypeCandidates = uniqueValues([
            resolvedSubtype,
            safeRequestedSubtype,
            0,
            1,
        ]);

        const utcCandidates = includeUtcParams ? [true] : [false, true];
        const pathCandidates = uniqueValues(
            configuredPlaybackPaths
                ? configuredPlaybackPaths.split(",").map((path) => normalizeRtspPath(path))
                : ["/cam/playback", "/cam/realmonitor"],
        ).filter(Boolean);

        const rtspCandidates = [];
        pathCandidates.forEach((candidatePath) => {
            const isCamPlaybackPath = /^\/cam\/playback$/i.test(String(candidatePath));
            const subtypeLoop = isCamPlaybackPath && !includeSubtypeOnCamPlayback
                ? [undefined]
                : subtypeCandidates;

            subtypeLoop.forEach((candidateSubtype) => {
                utcCandidates.forEach((candidateUseUtc) => {
                    const hasSubtype = candidateSubtype !== undefined && candidateSubtype !== null && candidateSubtype !== "";
                    const candidateQuery = {
                        channel,
                        starttime: formattedStart,
                        endtime: formattedEnd,
                        ...(candidateUseUtc ? {
                            starttimeRealUTC: formattedStartUtc,
                            endtimeRealUTC: formattedEndUtc,
                        } : {}),
                        ...(hasSubtype ? { subtype: candidateSubtype } : {}),
                        ...playbackExtraQuery,
                    };

                    const candidateRtspUrl = playbackTemplate
                        ? applyRtspCredentials(
                            buildFromTemplate(playbackTemplate, {
                                channel,
                                subtype: hasSubtype ? candidateSubtype : "",
                                starttime: formattedStart,
                                endtime: formattedEnd,
                                starttimeRealUTC: formattedStartUtc,
                                endtimeRealUTC: formattedEndUtc,
                                username: activeCredentials.username || "",
                                password: activeCredentials.password || "",
                                usernameEncoded: encodeUserInfo(activeCredentials.username || ""),
                                passwordEncoded: encodeUserInfo(activeCredentials.password || ""),
                            }),
                            activeCredentials,
                        )
                        : buildRtspUrl(candidatePath, candidateQuery);

                    if (!candidateRtspUrl) {
                        return;
                    }

                    if (rtspCandidates.includes(candidateRtspUrl)) {
                        return;
                    }

                    rtspCandidates.push(candidateRtspUrl);
                });
            });
        });

        const rtspUrl = rtspCandidates[0] || "";
        const rtspFallbackUrls = rtspCandidates.slice(1);
        const hlsUrl = buildPlaybackHlsUrl({
            channel,
            starttime: formattedStart,
            endtime: formattedEnd,
            rtspUrl,
            streamName,
        });
        const playbackPlayerUrl = buildPlaybackPlayerUrl({
            channel,
            streamName,
        });

        return {
            mode: "playback",
            streamName,
            rtspUrl,
            rtspFallbackUrls,
            hlsUrl,
            playbackPlayerUrl,
            query: {
                ...query,
                subtype: resolvedSubtype,
            },
        };
    },
    getGo2rtcStreams: async () => {
        const response = await fetch("/go2rtc/api/streams", {
            method: "GET",
            cache: "no-store",
        });

        if (!response.ok) {
            const detail = await response.text().catch(() => "");
            throw new Error(detail || `Gagal mengambil status go2rtc (${response.status})`);
        }

        return response.json().catch(() => ({}));
    },
    findPlaybackRecordings: async ({ channel, subtype = 0, dayStart, dayEnd, maxItems = 200 }) => {
        const safeChannel = Number(channel);
        if (!Number.isFinite(safeChannel) || safeChannel < 1) {
            return [];
        }
        const includeVideoStream = envFlagEnabled("VITE_MEDIA_FILEFIND_INCLUDE_VIDEO_STREAM", false);

        const responseCreate = await ApiClient.get("/cgi-bin/mediaFileFind.cgi?action=factory.create");
        const createMap = parseKeyValuePayload(responseCreate?.data);
        const objectId = String(
            createMap.object
            || createMap.result
            || createMap.Object
            || "",
        ).trim();

        if (!objectId) {
            return [];
        }

        const allRows = [];
        const pageSize = Math.max(1, Math.min(10, Number(maxItems) || 10));
        const targetMax = Math.max(1, Math.min(500, Number(maxItems) || 200));
        const basePath = "/cgi-bin/mediaFileFind.cgi";

        const shouldCleanupFinder = envFlagEnabled("VITE_MEDIA_FILEFIND_CLEANUP", false);

        try {
            const findFileQuery = buildQueryString({
                action: "findFile",
                object: objectId,
                "condition.Channel": safeChannel,
                "condition.StartTime": toDahuaDateTime(dayStart),
                "condition.EndTime": toDahuaDateTime(dayEnd),
                "condition.Types[0]": "dav",
                ...(includeVideoStream ? { "condition.VideoStream": toDahuaVideoStream(subtype) } : {}),
            });
            await ApiClient.get(`${basePath}?${findFileQuery}`);

            while (allRows.length < targetMax) {
                const nextQuery = buildQueryString({
                    action: "findNextFile",
                    object: objectId,
                    count: pageSize,
                });
                const responseNext = await ApiClient.get(`${basePath}?${nextQuery}`);
                const payload = parseKeyValuePayload(responseNext?.data);
                const foundCount = Number(payload.found || 0);
                const chunkRows = parseRecordingRows(responseNext?.data);

                if (chunkRows.length > 0) {
                    allRows.push(...chunkRows);
                }

                if (foundCount <= 0 || chunkRows.length === 0 || chunkRows.length < pageSize) {
                    break;
                }
            }

            return allRows.slice(0, targetMax);
        } finally {
            if (shouldCleanupFinder) {
                const closeQuery = buildQueryString({
                    action: "close",
                    object: objectId,
                });
                await ApiClient.get(`${basePath}?${closeQuery}`).catch(() => {});

                const destroyQuery = buildQueryString({
                    action: "destroy",
                    object: objectId,
                });
                await ApiClient.get(`${basePath}?${destroyQuery}`).catch(() => {});
            }
        }
    },
};
