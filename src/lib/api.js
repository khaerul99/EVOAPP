import axios from 'axios'
import { setupInterceptors } from './api-interceptor'

const CAMERA_URL = import.meta.env.DEV ? '/' : '/api/camera'

function serializeQueryParams(params) {
    const parts = [];

    const append = (key, value) => {
        if (value === undefined || value === null) {
            return;
        }

        if (Array.isArray(value)) {
            value.forEach((entry, index) => {
                append(`${key}[${index}]`, entry);
            });
            return;
        }

        if (value instanceof Date) {
            parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(value.toISOString())}`);
            return;
        }

        if (typeof value === 'object') {
            Object.entries(value).forEach(([childKey, childValue]) => {
                append(`${key}.${childKey}`, childValue);
            });
            return;
        }

        parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
    };

    Object.entries(params || {}).forEach(([key, value]) => {
        append(key, value);
    });

    return parts.join('&');
}

const ApiClient = axios.create({
    baseURL: CAMERA_URL,
    timeout: 10000,
    paramsSerializer: {
        serialize: serializeQueryParams,
    },
})

function mergeSearchParams(searchParams) {
    const merged = {}
    searchParams.forEach((value, key) => {
        if (Object.prototype.hasOwnProperty.call(merged, key)) {
            const current = merged[key]
            merged[key] = Array.isArray(current) ? [...current, value] : [current, value]
            return
        }
        merged[key] = value
    })
    return merged
}

function buildProxyTarget(urlValue) {
    const rawUrl = String(urlValue || '').trim()
    if (!rawUrl.startsWith('/')) {
        return null
    }

    const parsed = new URL(rawUrl, 'http://localhost')
    const normalizedPath = parsed.pathname.replace(/^\/+/, '')
    if (!normalizedPath) {
        return null
    }

    return {
        url: '/_proxy',
        params: {
            __path: normalizedPath,
            ...mergeSearchParams(parsed.searchParams),
        },
    }
}

ApiClient.interceptors.request.use((config) => {
    if (import.meta.env.DEV || config?.__skipCameraProxyTransform) {
        return config
    }

    const target = buildProxyTarget(config?.url)
    if (!target) {
        return config
    }

    return {
        ...config,
        url: target.url,
        params: {
            ...target.params,
            ...(config.params || {}),
        },
    }
})

setupInterceptors(ApiClient)

export default ApiClient
