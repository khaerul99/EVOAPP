import ApiClient from "../../lib/api";
import { authStore } from "../../stores/authSlice";

let warmupPromise = null;
let lastWarmupAt = 0;

function shouldSkipWarmup(now) {
    const cooldownMs = Number(import.meta.env.VITE_DIGEST_WARMUP_COOLDOWN_MS || 15000);
    return Number.isFinite(cooldownMs) && cooldownMs > 0 && now - lastWarmupAt < cooldownMs;
}

/**
 * Warmup digest challenge dengan request ke endpoint yang memerlukan digest auth.
 * Ini memastikan challenge sudah di-cache sebelum request actual pertama.
 * 
 * Flow:
 * 1. Request pertama (tanpa digest header) → server return 401 dengan challenge
 * 2. Interceptor tangkap 401 → extract challenge → store di state
 * 3. Nonce dan credentials sudah ready untuk request berikutnya
 * 
 * @returns {Promise<void>}
 */
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

    // Endpoint yang dijamin tersedia dan memerlukan digest auth
    const warmupEndpoint = "/cgi-bin/configManager.cgi?action=getConfig&name=ChannelTitle";

    warmupPromise = ApiClient.get(warmupEndpoint, {
        timeout: requestTimeout,
    })
    .then(async (res) => {
        // Beri waktu browser menyimpan dan memproses nonce ke state
        await new Promise(r => setTimeout(r, 300)); 
        return res;
    })
    .catch(() => null)
    .finally(() => {
        lastWarmupAt = Date.now();
        warmupPromise = null;
    });

    return warmupPromise;
}

/**
 * Check apakah challenge masih valid/fresh.
 * Return true jika perlu refresh challenge.
 */
export function isDigestChallengeTooOld() {
    const authState = authStore.getState();
    if (!authState?.challenge?.nonce) {
        return true;
    }
    
    // Challenge bisa dianggap kadaluarsa setelah 25 menit
    const maxAgeMs = 25 * 60 * 1000;
    const ageSinceLastWarmup = Date.now() - lastWarmupAt;
    
    return ageSinceLastWarmup > maxAgeMs;
}
