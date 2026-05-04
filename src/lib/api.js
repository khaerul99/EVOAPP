import axios from 'axios'
import { setupInterceptors } from './api-interceptor'

const CAMERA_URL = import.meta.env.DEV ? '/' : '/api/camera/'

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

setupInterceptors(ApiClient)

export default ApiClient
