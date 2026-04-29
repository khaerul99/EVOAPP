import { create } from 'zustand'
import { clearSession } from '../lib/session-helper'
import { cameraService } from '../services/camera/camera.service'
import { cameraSettingsService } from '../services/camera/camera-settings.service'
import { MENU_CONFIG } from '../lib/camera-settings.config'

let realtimePollingTimer = null
let cameraSnapshotPromise = null
const ENABLE_EVENT_ATTACH = String(import.meta.env.VITE_ENABLE_EVENT_ATTACH || 'false').toLowerCase() === 'true'

function stopRealtimeTimer() {
    if (realtimePollingTimer) {
        clearInterval(realtimePollingTimer)
        realtimePollingTimer = null
    }
}

function normalizeCameraRows(rows = []) {
    return (Array.isArray(rows) ? rows : []).map((camera, index) => ({
        ...camera,
        id: Number.isFinite(Number(camera.id)) ? Number(camera.id) : index + 1,
    }))
}

function buildStatusByChannel(rows = []) {
    return (Array.isArray(rows) ? rows : []).reduce((accumulator, row) => {
        const channelId = Number(row?.id)
        if (!Number.isFinite(channelId) || channelId < 1) {
            return accumulator
        }

        accumulator[`ch${channelId}`] = {
            status: String(row?.status || 'unknown').toLowerCase(),
            record: Boolean(row?.record),
            statusMessage: String(row?.statusMessage || ''),
            ip: String(row?.ip || ''),
        }
        return accumulator
    }, {})
}

function buildRecordByChannel(rows = []) {
    return (Array.isArray(rows) ? rows : []).reduce((accumulator, row) => {
        const channelId = Number(row?.id)
        if (!Number.isFinite(channelId) || channelId < 1) {
            return accumulator
        }

        accumulator[`ch${channelId}`] = Boolean(row?.record)
        return accumulator
    }, {})
}

function buildOnlineChannels(rows = []) {
    return rows
        .filter((row) => String(row?.status || '').toLowerCase() === 'online')
        .map((row) => ({
            id: `ch${row.id}`,
            label: `${row.id} - ${row.channelName || row.name || `Channel ${row.id}`}`,
            ip: row.ip || '-',
        }))
}

async function fetchCameraSnapshot(set, get) {
    if (cameraSnapshotPromise) {
        return cameraSnapshotPromise
    }

    cameraSnapshotPromise = (async () => {
        set({
            isLoadingChannels: true,
            isLoadingCameras: true,
            channelError: '',
            cameraError: '',
        })

        try {
            console.log('[useStore.fetchCameraSnapshot] Starting camera fetch...')
            const rows = await cameraService.getCameraChannels()
            
            const cameras = normalizeCameraRows(rows)
            const onlineChannels = buildOnlineChannels(cameras)
            const cameraStatusByChannel = buildStatusByChannel(cameras)
            const cameraRecordByChannel = buildRecordByChannel(cameras)

            // log

            const previousActive = get().activeChannel
            const nextActive = onlineChannels.length === 0
                ? ''
                : (onlineChannels.some((channel) => channel.id === previousActive) ? previousActive : onlineChannels[0].id)

            set({
                cameras,
                onlineChannels,
                cameraStatusByChannel,
                cameraRecordByChannel,
                activeChannel: nextActive,
                cameraSnapshot: {
                    cameras,
                    onlineChannels,
                    activeChannel: nextActive,
                    cameraStatusByChannel,
                    cameraRecordByChannel,
                    fetchedAt: new Date().toISOString(),
                },
                isLoadingChannels: false,
                isLoadingCameras: false,
                channelError: '',
                cameraError: '',
            })
            return cameras
        } catch (error) {
            const errorMessage = error?.response?.data?.message || error?.message || 'Gagal memuat data kamera dari perangkat.'
            set({
                cameras: [],
                onlineChannels: [],
                cameraStatusByChannel: {},
                cameraRecordByChannel: {},
                activeChannel: '',
                cameraSnapshot: {
                    cameras: [],
                    onlineChannels: [],
                    activeChannel: '',
                    cameraStatusByChannel: {},
                    cameraRecordByChannel: {},
                    fetchedAt: '',
                },
                isLoadingChannels: false,
                isLoadingCameras: false,
                channelError: errorMessage,
                cameraError: errorMessage,
            })
            throw error
        } finally {
            cameraSnapshotPromise = null
        }
    })()

    return cameraSnapshotPromise
}

const createAuthSlice = (set, get) => {
    // Create stable function references that won't be recreated on each store access
    const stableFetchCameraSnapshot = () => fetchCameraSnapshot(set, get)

    return {
        cameras: [],
        onlineChannels: [],
        cameraStatusByChannel: {},
        cameraRecordByChannel: {},
        activeChannel: '',
        cameraSnapshot: {
            cameras: [],
            onlineChannels: [],
            activeChannel: '',
            cameraStatusByChannel: {},
            cameraRecordByChannel: {},
            fetchedAt: '',
        },
        activeMenu: MENU_CONFIG[0]?.key || 'peopleCounting',
        isLoadingChannels: false,
        isLoadingCameras: false,
        channelError: '',
        cameraError: '',
        realtimeEvents: {},
        isRealtimeLoading: false,
        realtimeError: '',
        realtimeUpdatedAt: '',
        realtimeUnauthorizedKeys: {},
        isBootstrapped: false,

        setActiveChannel: (channelId) => set((previous) => ({
            activeChannel: channelId || '',
            cameraSnapshot: {
                ...previous.cameraSnapshot,
                activeChannel: channelId || '',
            },
        })),
        setActiveMenu: (menuKey) => set({ activeMenu: menuKey }),

        fetchOnlineChannels: stableFetchCameraSnapshot,

        fetchCameras: stableFetchCameraSnapshot,

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
        await fetchCameraSnapshot(set, get)
        
        const activeMenu = get().activeMenu
        const activeConfig = MENU_CONFIG.find((item) => item.key === activeMenu) || MENU_CONFIG[0]
        if (activeConfig?.eventCodes?.length) {
            get().startRealtimePolling(activeConfig.eventCodes)
        }

        set({ isBootstrapped: true })
    },

    resetCameraState: () => {
        stopRealtimeTimer()
        cameraSnapshotPromise = null
        set({
            cameras: [],
            onlineChannels: [],
                cameraStatusByChannel: {},
                cameraRecordByChannel: {},
            activeChannel: '',
            cameraSnapshot: {
                cameras: [],
                onlineChannels: [],
                activeChannel: '',
                cameraStatusByChannel: {},
                    cameraRecordByChannel: {},
                fetchedAt: '',
            },
            activeMenu: MENU_CONFIG[0]?.key || 'peopleCounting',
            isLoadingChannels: false,
            isLoadingCameras: false,
            channelError: '',
            cameraError: '',
            realtimeEvents: {},
            isRealtimeLoading: false,
            realtimeError: '',
            realtimeUpdatedAt: '',
            realtimeUnauthorizedKeys: {},
            isBootstrapped: false,
        })
    }
}
}

export const useStore = create((set, get) => ({
    ...createAuthSlice(set, get),
}))

export async function logout() {
    useStore.getState().resetCameraState()
    clearSession()
}
