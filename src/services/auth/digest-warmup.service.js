import ApiClient from "../../lib/api";

const DEFAULT_WARMUP_PATHS = [
    "/cgi-bin/configManager.cgi?action=getConfig&name=ChannelTitle",
    "/cgi-bin/configManager.cgi?action=getConfig&name=RemoteDevice",
];

let warmupPromise = null;
let lastWarmupAt = 0;

function parseWarmupPathsFromEnv() {
    const raw = String(import.meta.env.VITE_DIGEST_WARMUP_PATHS || "").trim();
    if (!raw) {
        return DEFAULT_WARMUP_PATHS;
    }

    const paths = raw
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);

    return paths.length > 0 ? paths : DEFAULT_WARMUP_PATHS;
}

function shouldSkipWarmup(now) {
    const cooldownMs = Number(import.meta.env.VITE_DIGEST_WARMUP_COOLDOWN_MS || 15000);
    return Number.isFinite(cooldownMs) && cooldownMs > 0 && now - lastWarmupAt < cooldownMs;
}

export function warmupDigestChallenge() {
    const now = Date.now();
    if (warmupPromise) {
        return warmupPromise;
    }
    if (shouldSkipWarmup(now)) {
        return Promise.resolve();
    }

    const timeoutMs = Number(import.meta.env.VITE_DIGEST_WARMUP_TIMEOUT_MS || 4500);
    const requestTimeout = Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 4500;
    const warmupPaths = parseWarmupPathsFromEnv();

    warmupPromise = Promise.allSettled(
        warmupPaths.map((path) =>
            ApiClient.get(path, {
                timeout: requestTimeout,
                headers: {
                    "Cache-Control": "no-cache, no-store",
                    Pragma: "no-cache",
                },
            }),
        ),
    )
        .catch(() => [])
        .finally(() => {
            lastWarmupAt = Date.now();
            warmupPromise = null;
        });

    return warmupPromise;
}
