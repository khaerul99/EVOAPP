import axios from 'axios'
import { setupInterceptors } from './api-interceptor'

const URL = import.meta.env.VITE_CAMERA_URL || '/api/camera'

const CAMERA_URL = import.meta.env.DEV
    ? '/'
    : URL

const ApiClient = axios.create({
    baseURL: CAMERA_URL,
    timeout: 10000,
})

setupInterceptors(ApiClient)

export default ApiClient
