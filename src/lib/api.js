import axios from 'axios'
import { setupInterceptors } from './api-interceptor'

const CAMERA_URL = import.meta.env.DEV ? '/' : '/api/camera'

const ApiClient = axios.create({
    baseURL: CAMERA_URL,
    timeout: 10000,
})

setupInterceptors(ApiClient)

export default ApiClient
