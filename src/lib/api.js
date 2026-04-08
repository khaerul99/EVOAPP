import axios from 'axios'
import { setupInterceptors } from './api-interceptor'

const CAMERA_URL = import.meta.env.VITE_CAMERA_URL
    ? '/'
    : '/api'

const ApiClient = axios.create({
    baseURL: CAMERA_URL,
    timeout: 10000,
})

setupInterceptors(ApiClient)

export default ApiClient
