import { playbackService } from "../playback/playback.service";
import { authStore } from "../../stores/authSlice";

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

function buildFromTemplate(template, map) {
    if (!template) {
        return "";
    }
    return Object.entries(map).reduce((output, [key, value]) => {
        return output.replaceAll(`{${key}}`, String(value ?? ""));
    }, String(template));
}

function mergeRtspQuery(urlValue, query) {
    const raw = String(urlValue || "").trim();
    if (!raw) {
        return "";
    }

    try {
        const url = new URL(raw);
        Object.entries(query || {}).forEach(([key, value]) => {
            if (!key || value === undefined || value === null || value === "") {
                return;
            }
            if (!url.searchParams.has(key)) {
                url.searchParams.set(key, String(value));
            }
        });
        return url.toString();
    } catch {
        return raw;
    }
}

function buildLiveHlsUrl({ channel, subtype = 0, rtspUrl = "" }) {
    const template = import.meta.env.VITE_HLS_LIVE_TEMPLATE || "";
    const stream = sanitizeNamePart(`live-ch${channel}-s${subtype}`) || "live-ch1-s0";
    return applyTemplate(template, {
        channel,
        subtype,
        stream,
        streamEncoded: encodeURIComponent(stream),
        rtsp: rtspUrl,
        rtspEncoded: encodeURIComponent(rtspUrl),
    });
}

function buildLivePlayerUrl({ channel, subtype = 0 }) {
    const template = import.meta.env.VITE_GO2RTC_LIVE_PLAYER_TEMPLATE || "/go2rtc/stream.html?src={streamEncoded}&mode=mse,hls,webrtc";
    const stream = sanitizeNamePart(`live-ch${channel}-s${subtype}`) || "live-ch1-s0";
    const resolved = applyTemplate(template, {
        channel,
        subtype,
        stream,
        streamEncoded: encodeURIComponent(stream),
    });
    return toGo2rtcUrl(resolved);
}

export const liveService = {
    buildLiveStreamSources: ({ channel, subtype = 0 }) => {
        const liveTemplate = String(import.meta.env.VITE_RTSP_LIVE_URL_TEMPLATE || "").trim();
        const activeCredentials = getActiveRtspCredentials();
        assertRtspCredentials(activeCredentials);
        const streamName = sanitizeNamePart(`live-ch${channel}-s${subtype}`) || "live-ch1-s0";
        const liveEnvExtraQuery = parseExtraRtspQuery("VITE_RTSP_LIVE_EXTRA_QUERY");
        const livePrimaryQuery = {
            channel,
            subtype,
            unicast: "true",
            proto: "Onvif",
            ...liveEnvExtraQuery,
        };
        const liveFallbackQuery = {
            channel,
            subtype,
            ...liveEnvExtraQuery,
        };

        const dynamicCandidates = [
            buildRtspUrl("/cam/realmonitor", livePrimaryQuery),
            buildRtspUrl("/cam/realmonitor", liveFallbackQuery),
        ];

        const resolvedTemplateRtsp = liveTemplate
            ? applyRtspCredentials(
                buildFromTemplate(liveTemplate, {
                    channel,
                    subtype,
                    username: activeCredentials.username || "",
                    password: activeCredentials.password || "",
                    usernameEncoded: encodeUserInfo(activeCredentials.username || ""),
                    passwordEncoded: encodeUserInfo(activeCredentials.password || ""),
                }),
                activeCredentials,
            )
            : "";

        const templateCandidates = resolvedTemplateRtsp
            ? [
                resolvedTemplateRtsp,
                mergeRtspQuery(resolvedTemplateRtsp, livePrimaryQuery),
                mergeRtspQuery(resolvedTemplateRtsp, liveFallbackQuery),
            ]
            : [];

        const rtspCandidates = uniqueValues([
            ...templateCandidates,
            ...dynamicCandidates,
        ]);
        const rtspUrl = rtspCandidates[0] || "";
        const rtspFallbackUrls = rtspCandidates.slice(1);
        const hlsUrl = buildLiveHlsUrl({
            channel,
            subtype,
            rtspUrl,
        });
        const livePlayerUrl = buildLivePlayerUrl({
            channel,
            subtype,
        });

        return {
            mode: "live",
            streamName,
            rtspUrl,
            rtspFallbackUrls,
            hlsUrl,
            livePlayerUrl,
            query: { channel, subtype },
        };
    },
    ensureGo2rtcStream: (payload) => playbackService.ensureGo2rtcStream(payload),
    waitForHlsReady: (payload) => playbackService.waitForHlsReady(payload),
    getGo2rtcStreams: () => playbackService.getGo2rtcStreams(),
};
