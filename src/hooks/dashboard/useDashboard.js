import { useEffect, useRef, useState } from 'react';
import { cameraService } from '../../services/camera/camera.service';
import { getSecurityLogs } from '../../lib/security-log';
import { buildDashboardEvents, deriveStats, normalizeCamera, pickDefaultActiveCamera } from '../../lib/dashboard-utils';

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
                    ? cameraData.map((camera, index) => normalizeCamera(camera, index, FALLBACK_THUMBNAILS))
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