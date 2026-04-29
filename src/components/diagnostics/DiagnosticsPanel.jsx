import React, { useState, useEffect } from 'react'
import { useStore } from '../../stores/useStore'
import { cameraService } from '../../services/camera/camera.service'
import { liveService } from '../../services/live/live.service'
import { deriveStats } from '../../lib/dashboard-utils'
import { getSecurityLogs } from '../../lib/security-log'

export default function DiagnosticsPanel() {
    const [expanded, setExpanded] = useState(false)
    const [diagnostics, setDiagnostics] = useState({
        cameras: [],
        stats: null,
        liveStreamUrls: {},
        liveErrors: {},
        rtspCredentials: null,
        rawApiResponse: null,
        storeState: null,
        logs: [],
    })
    const [loading, setLoading] = useState(false)

    const cameras = useStore((state) => state.cameras)
    const onlineChannels = useStore((state) => state.onlineChannels)

    const fetchDiagnostics = async () => {
        setLoading(true)
        try {
            // Get raw API response
            let rawApiResponse = null
            try {
                const rows = await cameraService.getCameraChannels()
                rawApiResponse = rows.map((row, idx) => ({
                    index: idx,
                    id: row.id,
                    name: row.name,
                    status: row.status,
                    statusMessage: row.statusMessage,
                    ip: row.ip,
                    manufacture: row.manufacture,
                }))
            } catch (error) {
                rawApiResponse = { error: error.message }
            }

            // Get store state
            const storeState = {
                camerasCount: cameras.length,
                cameras: cameras.map((cam, idx) => ({
                    index: idx,
                    id: cam.id,
                    name: cam.name,
                    status: cam.status,
                    ip: cam.ip,
                })),
                onlineChannelsCount: onlineChannels.length,
                onlineChannels,
            }

            // Get stats
            const securityLogs = getSecurityLogs()
            const stats = deriveStats(cameras, securityLogs)

            // Get RTSP credentials
            const rtspCredentials = {
                env_username: import.meta.env.VITE_RTSP_USERNAME || 'NOT SET',
                env_password: import.meta.env.VITE_RTSP_PASSWORD ? '***' : 'NOT SET',
                env_host: import.meta.env.VITE_RTSP_HOST || 'NOT SET',
                env_port: import.meta.env.VITE_RTSP_PORT || 'NOT SET',
                env_gateway: import.meta.env.VITE_HLS_GATEWAY_URL || 'NOT SET',
                env_go2rtc_player: import.meta.env.VITE_GO2RTC_LIVE_PLAYER_TEMPLATE || 'NOT SET',
            }

            // Try to build live stream URLs for each camera
            const liveStreamUrls = {}
            const liveErrors = {}
            cameras.slice(0, 3).forEach((camera) => {
                try {
                    const urls = liveService.buildLiveStreamSources(camera)
                    liveStreamUrls[camera.id] = urls
                } catch (error) {
                    liveErrors[camera.id] = error.message
                }
            })

            setDiagnostics({
                cameras,
                stats,
                liveStreamUrls,
                liveErrors,
                rtspCredentials,
                rawApiResponse,
                storeState,
                logs: securityLogs.slice(0, 5),
            })
        } catch (error) {
            console.error('Diagnostics error:', error)
            setDiagnostics((prev) => ({
                ...prev,
                error: error.message,
            }))
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        if (expanded) {
            fetchDiagnostics()
        }
    }, [expanded])

    return (
        <div className="fixed bottom-4 right-4 z-50 max-w-96 font-mono text-xs">
            <button
                onClick={() => setExpanded(!expanded)}
                className="bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded mb-2 w-full"
            >
                {expanded ? '✕ Close Diagnostics' : '🔍 Diagnostics'}
            </button>

            {expanded && (
                <div className="bg-gray-900 text-gray-100 p-3 rounded border border-red-500 max-h-96 overflow-y-auto shadow-lg">
                    <button
                        onClick={fetchDiagnostics}
                        disabled={loading}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded mb-2 w-full disabled:opacity-50"
                    >
                        {loading ? '⟳ Loading...' : '🔄 Refresh'}
                    </button>

                    {diagnostics.error && (
                        <div className="bg-red-900 text-red-100 p-2 rounded mb-2">
                            Error: {diagnostics.error}
                        </div>
                    )}

                    {/* Raw API Response */}
                    <div className="mb-3 border-b border-gray-700 pb-2">
                        <div className="font-bold text-cyan-400">Raw API Response:</div>
                        {diagnostics.rawApiResponse?.error && (
                            <div className="text-red-400">⚠️ {diagnostics.rawApiResponse.error}</div>
                        )}
                        {Array.isArray(diagnostics.rawApiResponse) && (
                            <pre className="text-xs bg-gray-800 p-2 rounded overflow-x-auto">
                                {JSON.stringify(diagnostics.rawApiResponse, null, 2)}
                            </pre>
                        )}
                    </div>

                    {/* Store State */}
                    <div className="mb-3 border-b border-gray-700 pb-2">
                        <div className="font-bold text-cyan-400">Store State:</div>
                        <div className="text-yellow-300">
                            Cameras: {diagnostics.storeState?.camerasCount || 0}
                        </div>
                        <div className="text-yellow-300">
                            Online Channels: {diagnostics.storeState?.onlineChannelsCount || 0}
                        </div>
                        {diagnostics.cameras.length > 0 && (
                            <div className="text-xs text-gray-300 mt-1">
                                {diagnostics.cameras.map((cam) => (
                                    <div key={cam.id} className="ml-2">
                                        #{cam.id} {cam.name}: <span className={cam.status === 'online' ? 'text-green-400' : 'text-red-400'}>{cam.status}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Stats */}
                    {diagnostics.stats && (
                        <div className="mb-3 border-b border-gray-700 pb-2">
                            <div className="font-bold text-cyan-400">Dashboard Stats:</div>
                            <div className="text-green-400">
                                Online: {diagnostics.stats.onlineCams}/{diagnostics.stats.totalCams}
                            </div>
                            <div className="text-red-400">
                                Offline: {diagnostics.stats.offlineCams}/{diagnostics.stats.totalCams}
                            </div>
                            <div className="text-blue-400">
                                People Today: {diagnostics.stats.peopleCountingToday}
                            </div>
                        </div>
                    )}

                    {/* RTSP Credentials */}
                    <div className="mb-3 border-b border-gray-700 pb-2">
                        <div className="font-bold text-cyan-400">RTSP Config:</div>
                        <div className="text-gray-300">
                            Host: <span className="text-yellow-300">{diagnostics.rtspCredentials?.env_host}</span>
                        </div>
                        <div className="text-gray-300">
                            User: <span className="text-yellow-300">{diagnostics.rtspCredentials?.env_username}</span>
                        </div>
                        <div className="text-gray-300">
                            Pass: <span className="text-yellow-300">{diagnostics.rtspCredentials?.env_password}</span>
                        </div>
                    </div>

                    {/* Live Stream URLs */}
                    {Object.keys(diagnostics.liveStreamUrls).length > 0 && (
                        <div className="mb-3 border-b border-gray-700 pb-2">
                            <div className="font-bold text-cyan-400">Live Stream URLs:</div>
                            {Object.entries(diagnostics.liveStreamUrls).map(([camId, urls]) => (
                                <div key={camId} className="text-xs mt-1">
                                    <div className="text-yellow-300">Camera {camId}:</div>
                                    {urls.livePlayerUrl && (
                                        <div className="text-gray-400 break-all">
                                            Player: {urls.livePlayerUrl.substring(0, 80)}...
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Live Stream Errors */}
                    {Object.keys(diagnostics.liveErrors).length > 0 && (
                        <div className="border-b border-gray-700 pb-2">
                            <div className="font-bold text-red-400">Live Stream Errors:</div>
                            {Object.entries(diagnostics.liveErrors).map(([camId, error]) => (
                                <div key={camId} className="text-red-300 text-xs">
                                    Camera {camId}: {error}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
