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

function buildRtspUrl(pathname, params) {
    const host = getCameraHost();
    const port = import.meta.env.VITE_RTSP_PORT || "554";
    const username = normalizeCredential(import.meta.env.VITE_RTSP_USERNAME || "");
    const password = normalizeCredential(import.meta.env.VITE_RTSP_PASSWORD || "");

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
    return applyTemplate(template, {
        channel,
        subtype,
        stream,
        streamEncoded: encodeURIComponent(stream),
    });
}

function buildPlaybackPlayerUrl({ channel }) {
    const template = import.meta.env.VITE_GO2RTC_PLAYBACK_PLAYER_TEMPLATE || "/go2rtc/stream.html?src={streamEncoded}&mode=mse";
    const stream = sanitizeNamePart(`playback-ch${channel}`) || "playback-ch1";
    return applyTemplate(template, {
        channel,
        stream,
        streamEncoded: encodeURIComponent(stream),
    });
}

function buildPlaybackHlsUrl({ channel, starttime, endtime, rtspUrl = "" }) {
    const template = import.meta.env.VITE_HLS_PLAYBACK_TEMPLATE || "";
    const stream = sanitizeNamePart(`playback-ch${channel}`) || "playback-ch1";
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

export const playbackService = {
    formatPlaybackTimestamp,
    ensureGo2rtcStream: async ({ streamName, rtspUrl }) => {
        if (!streamName || !rtspUrl) {
            return;
        }

        const registerPath = import.meta.env.VITE_GO2RTC_STREAM_REGISTER_PATH || "/go2rtc/api/streams";
        const registerUrl = new URL(registerPath, window.location.origin);
        registerUrl.searchParams.set("name", streamName);
        registerUrl.searchParams.set("src", rtspUrl);

        const response = await fetch(registerUrl.toString(), {
            method: "PUT",
        });

        if (!response.ok) {
            const detail = await response.text().catch(() => "");
            throw new Error(detail || `Register stream gagal (${response.status})`);
        }
    },
    buildLiveStreamSources: ({ channel, subtype = 0 }) => {
        const streamName = sanitizeNamePart(`live-ch${channel}-s${subtype}`) || "live-ch1-s0";
        const rtspUrl = buildRtspUrl("/cam/realmonitor", {
            channel,
            subtype,
        });
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
            hlsUrl,
            livePlayerUrl,
            query: { channel, subtype },
        };
    },
    buildPlaybackStreamSources: ({ channel, subtype = 0, starttime, endtime }) => {
        const streamName = sanitizeNamePart(`playback-ch${channel}`) || "playback-ch1";
        const formattedStart = formatPlaybackTimestamp(starttime);
        const formattedEnd = formatPlaybackTimestamp(endtime);
        const formattedStartUtc = formatPlaybackTimestampUtc(starttime);
        const formattedEndUtc = formatPlaybackTimestampUtc(endtime);

        const query = {
            channel,
            starttime: formattedStart,
            endtime: formattedEnd,
            starttimeRealUTC: formattedStartUtc,
            endtimeRealUTC: formattedEndUtc,
            subtype,
        };

        const rtspUrl = buildRtspUrl("/cam/playback", query);
        const hlsUrl = buildPlaybackHlsUrl({
            channel,
            starttime: formattedStart,
            endtime: formattedEnd,
            rtspUrl,
        });
        const playbackPlayerUrl = buildPlaybackPlayerUrl({
            channel,
        });

        return {
            mode: "playback",
            streamName,
            rtspUrl,
            hlsUrl,
            playbackPlayerUrl,
            query: {
                ...query,
                subtype,
            },
        };
    },
};
