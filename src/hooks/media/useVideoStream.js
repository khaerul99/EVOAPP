import { useMemo } from 'react'
import ApiClient from '../../lib/api'

export function useVideoStream() {
    const baseUrl = useMemo(() => ApiClient.defaults.baseURL || '/', [])

    const request = async (path, options = {}) =>
        ApiClient.request({
            url: path,
            ...options,
        })

    return {
        baseUrl,
        request,
    }
}
