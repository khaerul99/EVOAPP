import { useEffect, useRef, useState } from 'react';
import { cameraService } from '../services/camera.service';
import { getSecurityLogs } from '../lib/security-log';

const FALLBACK_THUMBNAILS = [
    'https://images.unsplash.com/photo-1497366811353-6870744d04b2?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=800&q=80',
];

const FALLBACK_CAMERAS = [
    { id: 1, name: 'Lobby Utama - Unit A1', channelName: 'Lobby Utama - Unit A1', deviceName: 'Demo Device', status: 'online', ip: '192.168.1.101', port: '554', record: true, manufacture: 'Demo', thumbnail: FALLBACK_THUMBNAILS[0] },
    { id: 2, name: 'Area Parkir Timur', channelName: 'Area Parkir Timur', deviceName: 'Demo Device', status: 'online', ip: '192.168.1.102', port: '554', record: true, manufacture: 'Demo', thumbnail: FALLBACK_THUMBNAILS[1] },
    { id: 3, name: 'Ruang Server Tier 3', channelName: 'Ruang Server Tier 3', deviceName: 'Demo Device', status: 'offline', ip: '192.168.1.105', port: '554', record: false, manufacture: 'Demo', thumbnail: FALLBACK_THUMBNAILS[2] },
];

function normalizeCamera(camera, index) {
    return {
        ...camera,
        id: Number.isFinite(Number(camera.id)) ? Number(camera.id) : index + 1,
        name: camera.name || camera.channelName || `Camera ${index + 1}`,
        channelName: camera.channelName || camera.name || `Camera ${index + 1}`,
        deviceName: camera.deviceName || camera.manufacture || '-',
        status: String(camera.status || 'offline').toLowerCase(),
        ip: camera.ip || '-',
        port: camera.port || '-',
        thumbnail: camera.thumbnail || FALLBACK_THUMBNAILS[index % FALLBACK_THUMBNAILS.length],
    };
}

function mapLogSeverity(level) {
    const normalized = String(level || 'info').toLowerCase();

    if (normalized === 'error' || normalized === 'warning') {
        return 'warning';
    }

    if (normalized === 'success') {
        return 'success';
    }

    return 'info';
}

function mapLogType(action) {
    const normalized = String(action || '').toLowerCase();

    switch (normalized) {
        case 'login_success':
            return 'Authentication Success';
        case 'login_failed':
            return 'Authentication Failed';
        case 'logout':
            return 'Session Closed';
        case 'settings_saved':
            return 'Settings Updated';
        case 'settings_reset':
            return 'Settings Reset';
        default:
            return 'Security Event';
    }
}

function mapLogCamera(action) {
    const normalized = String(action || '').toLowerCase();

    switch (normalized) {
        case 'login_success':
        case 'login_failed':
            return 'Authentication Gateway';
        case 'logout':
            return 'Session Control';
        case 'settings_saved':
        case 'settings_reset':
            return 'System Settings';
        default:
            return 'System';
    }
}

function formatTime(timestamp) {
    try {
        return new Date(timestamp).toLocaleTimeString('id-ID', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false,
        });
    } catch {
        return '-';
    }
}

function buildDashboardEvents(cameras, securityLogs) {
    const activeCameras = (cameras || []).filter((camera) => camera.status === 'online');
    const cameraEvents = activeCameras.slice(0, 3).map((camera, index) => {
        const timestamp = Date.now() - index * 60_000;

        return {
            id: `camera-${camera.id}`,
            timestamp,
            type: 'Camera Online',
            camera: camera.channelName || camera.name || `Camera ${index + 1}`,
            time: formatTime(timestamp),
            detail: `Stream healthy on ${camera.ip}`,
            severity: 'success',
        };
    });

    const logEvents = (securityLogs || []).slice(0, 5).map((log, index) => {
        const timestamp = Number(log.timestamp) || Date.now() - (index + 1) * 90_000;

        return {
            id: log.id || `log-${index}`,
            timestamp,
            type: mapLogType(log.action),
            camera: mapLogCamera(log.action),
            time: formatTime(timestamp),
            detail: log.message || log.action || 'Security event',
            severity: mapLogSeverity(log.level),
        };
    });

    return [...logEvents, ...cameraEvents]
        .sort((left, right) => right.timestamp - left.timestamp)
        .slice(0, 5)
        .map(({ timestamp, ...event }) => event);
}

function deriveStats(cameras, securityLogs) {
    const totalCams = cameras.length;
    const onlineCams = cameras.filter((camera) => camera.status === 'online').length;
    const offlineCams = Math.max(totalCams - onlineCams, 0);
    const loginSuccessCount = securityLogs.filter((log) => log.action === 'login_success').length;
    const loginFailedCount = securityLogs.filter((log) => log.action === 'login_failed').length;
    const settingsSavedCount = securityLogs.filter((log) => log.action === 'settings_saved').length;

    return {
        peopleCount: Math.max(onlineCams * 18 + loginSuccessCount * 4 + settingsSavedCount, 0),
        faceDetected: Math.max(totalCams * 12 + loginFailedCount * 3 + offlineCams * 2, 0),
        faceRecognized: Math.max(loginSuccessCount * 6 + settingsSavedCount * 2, 0),
        totalCams,
        onlineCams,
        offlineCams,
    };
}

function pickDefaultActiveCamera(cameras) {
    const onlineCamera = cameras.find((camera) => camera.status === 'online');
    return onlineCamera || cameras[0] || null;
}

export const useDashboard = () => {
    const [cameras, setCameras] = useState(() => FALLBACK_CAMERAS);
    const [activeCamera, setActiveCamera] = useState(() => FALLBACK_CAMERAS[0]);
    const [events, setEvents] = useState(() => buildDashboardEvents(FALLBACK_CAMERAS, getSecurityLogs()));
    const [stats, setStats] = useState(() => deriveStats(FALLBACK_CAMERAS, getSecurityLogs()));
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [currentDateTime, setCurrentDateTime] = useState(new Date());
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const playerRef = useRef(null);

    useEffect(() => {
        const clockTimer = setInterval(() => setCurrentDateTime(new Date()), 1000);
        return () => clearInterval(clockTimer);
    }, []);

    useEffect(() => {
        let cancelled = false;

        const fetchCameras = async () => {
            setIsLoading(true);

            try {
                const cameraData = await cameraService.getCameraChannels();
                if (cancelled) {
                    return;
                }

                const normalizedCameras = Array.isArray(cameraData)
                    ? cameraData.map((camera, index) => normalizeCamera(camera, index))
                    : [];

                if (normalizedCameras.length > 0) {
                    setCameras(normalizedCameras);
                    setActiveCamera((currentCamera) => {
                        if (currentCamera && normalizedCameras.some((camera) => camera.id === currentCamera.id && camera.status === 'online')) {
                            return normalizedCameras.find((camera) => camera.id === currentCamera.id) || pickDefaultActiveCamera(normalizedCameras);
                        }

                        return pickDefaultActiveCamera(normalizedCameras);
                    });
                    setError('');
                } else {
                    setCameras([]);
                    setActiveCamera(null);
                    setError('Belum ada kamera yang tersedia dari perangkat.');
                }
            } catch (fetchError) {
                if (cancelled) {
                    return;
                }

                setCameras(FALLBACK_CAMERAS);
                setActiveCamera(FALLBACK_CAMERAS[0]);
                setError('Gagal memuat data kamera dari perangkat. Menampilkan data cadangan.');
                console.error('Camera fetch error:', fetchError);
            } finally {
                if (!cancelled) {
                    setIsLoading(false);
                }
            }
        };

        fetchCameras();

        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        if (!cameras.length) {
            setActiveCamera(null);
            return;
        }

        setActiveCamera((currentCamera) => {
            if (currentCamera && cameras.some((camera) => camera.id === currentCamera.id && camera.status === 'online')) {
                return cameras.find((camera) => camera.id === currentCamera.id) || pickDefaultActiveCamera(cameras);
            }

            return pickDefaultActiveCamera(cameras);
        });
    }, [cameras]);

    useEffect(() => {
        const refreshDashboardData = () => {
            const securityLogs = getSecurityLogs();
            setStats(deriveStats(cameras, securityLogs));
            setEvents(buildDashboardEvents(cameras, securityLogs));
        };

        refreshDashboardData();

        const timer = setInterval(refreshDashboardData, 5000);
        return () => clearInterval(timer);
    }, [cameras]);

    useEffect(() => {
        const handleFullscreenChange = () => {
            setIsFullscreen(!!document.fullscreenElement);
        };

        document.addEventListener('fullscreenchange', handleFullscreenChange);
        return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
    }, []);

    const handleToggleFullscreen = async () => {
        try {
            if (!document.fullscreenElement) {
                if (playerRef.current?.requestFullscreen) {
                    await playerRef.current.requestFullscreen();
                }
            } else if (document.exitFullscreen) {
                await document.exitFullscreen();
            }
        } catch (fullscreenError) {
            console.error('Fullscreen error:', fullscreenError);
        }
    };

    return {
        activeCamera,
        setActiveCamera,
        cameras,
        events,
        setEvents,
        isFullscreen,
        setIsFullscreen,
        currentDateTime,
        playerRef,
        stats,
        isLoading,
        error,
        handleToggleFullscreen,
    };
};