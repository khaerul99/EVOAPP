import ApiClient from "../../lib/api";

let warmupPromise = null;
let lastWarmupAt = 0;

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

    warmupPromise = ApiClient.get("/cgi-bin/configManager.cgi?action=getConfig&name=ChannelTitle", {
        timeout: requestTimeout
    })
    .then(async (res) => {
        await new Promise(r => setTimeout(r, 800)); // Beri waktu browser simpan nonce
        return res;
    })
    .catch(() => null)
    .finally(() => {
        lastWarmupAt = Date.now();
        warmupPromise = null;
    });

    return warmupPromise;
}
