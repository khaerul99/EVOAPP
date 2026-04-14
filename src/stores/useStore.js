import { clearSession } from '../lib/session-helper'

export async function logout() {
    clearSession()
}
