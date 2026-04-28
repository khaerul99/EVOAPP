import { create } from 'zustand'
import { clearSession } from '../lib/session-helper'
import { cameraService } from '../services/camera/camera.service'
import { cameraSettingsService } from '../services/camera/camera-settings.service'
import { warmupDigestChallenge } from '../services/auth/digest-warmup.service'
import { MENU_CONFIG } from '../lib/camera-settings.config'

let realtimePollingTimer = null
const ENABLE_EVENT_ATTACH = String(import.meta.env.VITE_ENABLE_EVENT_ATTACH || 'false').toLowerCase() === 'true'

function stopRealtimeTimer() {
    if (realtimePollingTimer) {
        clearInterval(realtimePollingTimer)
        realtimePollingTimer = null
    }
}

export const useStore = create((set, get) => ({
    onlineChannels: [],
    activeChannel: '',
    activeMenu: MENU_CONFIG[0]?.key || 'peopleCounting',
    isLoadingChannels: false,
    channelError: '',
    realtimeEvents: {},
    isRealtimeLoading: false,
    realtimeError: '',
    realtimeUpdatedAt: '',
    realtimeUnauthorizedKeys: {},
    isBootstrapped: false,

    setActiveChannel: (channelId) => set({ activeChannel: channelId || '' }),
    setActiveMenu: (menuKey) => set({ activeMenu: menuKey }),

    fetchOnlineChannels: async () => {
        set({ isLoadingChannels: true, channelError: '' })
        try {
            const rows = await cameraService.getCameraChannels()
            const onlineRows = (Array.isArray(rows) ? rows : []).filter(
                (row) => String(row?.status || '').toLowerCase() === 'online',
            )

            const mapped = onlineRows.map((row) => ({
                id: `ch${row.id}`,
                label: `${row.id} - ${row.channelName || row.name || `Channel ${row.id}`}`,
                ip: row.ip || '-',
            }))

            const previousActive = get().activeChannel
            const nextActive = mapped.length === 0
                ? ''
                : (mapped.some((channel) => channel.id === previousActive) ? previousActive : mapped[0].id)

            set({
                onlineChannels: mapped,
                activeChannel: nextActive,
                isLoadingChannels: false,
                channelError: '',
            })
        } catch {
            set({
                onlineChannels: [],
                activeChannel: '',
                isLoadingChannels: false,
                channelError: 'Gagal memuat daftar kamera online.',
            })
        }
    },

    fetchRealtimeOnce: async (eventCodes = []) => {
        if (!ENABLE_EVENT_ATTACH) {
            set({
                realtimeEvents: {},
                isRealtimeLoading: false,
                realtimeError: 'Realtime eventManager dimatikan (default) untuk mencegah 401/cancelled. Aktifkan VITE_ENABLE_EVENT_ATTACH=true jika endpoint sudah diizinkan.',
            })
            return
        }

        const activeChannel = get().activeChannel
        if (!activeChannel || !eventCodes.length) {
            set({
                realtimeEvents: {},
                realtimeError: '',
                realtimeUpdatedAt: '',
                isRealtimeLoading: false,
            })
            return
        }

        const eventKey = `${activeChannel}:${eventCodes.join(',')}`
        if (get().realtimeUnauthorizedKeys[eventKey]) {
            set({
                isRealtimeLoading: false,
                realtimeError: 'Endpoint eventManager ditolak (401) oleh device untuk channel/menu ini.',
            })
            return
        }

        const channelNumber = Number(String(activeChannel).replace('ch', ''))
        if (!Number.isFinite(channelNumber)) {
            set({
                realtimeError: 'ID channel tidak valid untuk endpoint.',
                isRealtimeLoading: false,
            })
            return
        }

        set({ isRealtimeLoading: true, realtimeError: '' })
        try {
            const result = await cameraSettingsService.getRealtimeEventStatus({
                channelId: channelNumber,
                eventCodes,
            })

            set({
                realtimeEvents: result.events || {},
                realtimeUpdatedAt: result.fetchedAt || new Date().toISOString(),
                isRealtimeLoading: false,
                realtimeError: '',
            })
        } catch (error) {
            const status = Number(error?.response?.status || 0)
            if (status === 401) {
                set((previous) => ({
                    isRealtimeLoading: false,
                    realtimeError: 'Endpoint eventManager ditolak (401) oleh device untuk channel/menu ini.',
                    realtimeUnauthorizedKeys: {
                        ...previous.realtimeUnauthorizedKeys,
                        [eventKey]: true,
                    },
                }))
                stopRealtimeTimer()
                return
            }

            set({
                isRealtimeLoading: false,
                realtimeError: 'Gagal mengambil data realtime dari endpoint eventManager.',
            })
        }
    },

    startRealtimePolling: (eventCodes = []) => {
        stopRealtimeTimer()
        if (!ENABLE_EVENT_ATTACH) {
            get().fetchRealtimeOnce(eventCodes)
            return
        }

        const activeChannel = get().activeChannel
        const eventKey = `${activeChannel}:${(eventCodes || []).join(',')}`
        if (get().realtimeUnauthorizedKeys[eventKey]) {
            set({
                isRealtimeLoading: false,
                realtimeError: 'Endpoint eventManager ditolak (401) oleh device untuk channel/menu ini.',
            })
            return
        }

        get().fetchRealtimeOnce(eventCodes)
        realtimePollingTimer = setInterval(() => {
            get().fetchRealtimeOnce(eventCodes)
        }, 6000)
    },

    stopRealtimePolling: () => {
        stopRealtimeTimer()
    },

    initializeAfterLogin: async () => {
        await warmupDigestChallenge().catch(() => {})
        await get().fetchOnlineChannels()

        const activeMenu = get().activeMenu
        const activeConfig = MENU_CONFIG.find((item) => item.key === activeMenu) || MENU_CONFIG[0]
        if (activeConfig?.eventCodes?.length) {
            get().startRealtimePolling(activeConfig.eventCodes)
        }

        set({ isBootstrapped: true })
    },

    resetCameraState: () => {
        stopRealtimeTimer()
        set({
            onlineChannels: [],
            activeChannel: '',
            activeMenu: MENU_CONFIG[0]?.key || 'peopleCounting',
            isLoadingChannels: false,
            channelError: '',
            realtimeEvents: {},
            isRealtimeLoading: false,
            realtimeError: '',
            realtimeUpdatedAt: '',
            realtimeUnauthorizedKeys: {},
            isBootstrapped: false,
        })
    },
}))

export async function logout() {
    useStore.getState().resetCameraState()
    clearSession()
}
