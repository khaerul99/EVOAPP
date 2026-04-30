import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../../stores/useStore';
import { getSecurityLogs } from '../../lib/security-log';
import { buildDashboardEvents, deriveStats, normalizeCamera, pickDefaultActiveCamera } from '../../lib/dashboard-utils';

const FALLBACK_THUMBNAILS = [
    'https://images.unsplash.com/photo-1497366811353-6870744d04b2?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=800&q=80',
];

export const useDashboard = () => {
    const cameras = useStore((state) => state.cameras);
    const cameraSnapshot = useStore((state) => state.cameraSnapshot);
    const channelConnectionStates = useStore((state) => state.channelConnectionStates);
    const onlineChannels = useStore((state) => state.onlineChannels);
    const activeChannel = useStore((state) => state.activeChannel);
    const isLoadingCameras = useStore((state) => state.isLoadingCameras);
    const cameraError = useStore((state) => state.cameraError);
    const fetchCameras = useStore((state) => state.fetchCameras);
    const setActiveChannel = useStore((state) => state.setActiveChannel);

    const [isFullscreen, setIsFullscreen] = useState(false);
    const [currentDateTime, setCurrentDateTime] = useState(new Date());
    const playerRef = useRef(null);

    useEffect(() => {
        const clockTimer = setInterval(() => setCurrentDateTime(new Date()), 1000);
        return () => clearInterval(clockTimer);
    }, []);

    useEffect(() => {
        fetchCameras();
        const refreshInterval = setInterval(fetchCameras, 30000);
        return () => clearInterval(refreshInterval);
    }, [fetchCameras]);

    const normalizedCameras = useMemo(
        () => {
            const normalized = cameras.map((camera, index) => normalizeCamera(camera, index, FALLBACK_THUMBNAILS));
            console.log('[useDashboard.normalizedCameras] Total:', normalized.length);
            normalized.forEach(cam => {
                console.log(`[useDashboard.normalizedCameras] Camera ${cam.id}:`, { name: cam.name, status: cam.status });
            });
            return normalized;
        },
        [cameras],
    );

    const activeCamera = useMemo(() => {
        if (normalizedCameras.length === 0) {
            console.log('[useDashboard.activeCamera] No normalized cameras');
            return null;
        }

        const activeChannelNumber = Number(String(activeChannel || '').replace(/\D/g, ''));
        console.log('[useDashboard.activeCamera] activeChannel:', activeChannel, 'parsed number:', activeChannelNumber);
        
        if (Number.isFinite(activeChannelNumber) && activeChannelNumber > 0) {
            const matchedCamera = normalizedCameras.find((camera) => Number(camera.id) === activeChannelNumber);
            if (matchedCamera) {
                console.log('[useDashboard.activeCamera] Matched camera:', matchedCamera.id, matchedCamera.name);
                return matchedCamera;
            }
        }

        const onlineCamera = normalizedCameras.find((camera) => camera.status === 'online');
        console.log('[useDashboard.activeCamera] First online camera:', onlineCamera?.id, onlineCamera?.name);
        const result = onlineCamera || pickDefaultActiveCamera(normalizedCameras);
        console.log('[useDashboard.activeCamera] Final result:', result?.id, result?.name);
        return result;
    }, [activeChannel, normalizedCameras]);

    const securityLogs = useMemo(() => getSecurityLogs(), [currentDateTime]);
    const stats = useMemo(() => {
        const derived = deriveStats(normalizedCameras, securityLogs, channelConnectionStates);
        console.log('[useDashboard.stats]', derived);
        return derived;
    }, [normalizedCameras, securityLogs, channelConnectionStates]);
    const events = useMemo(() => buildDashboardEvents(normalizedCameras, securityLogs), [normalizedCameras, securityLogs]);

    const setActiveCamera = useCallback((camera) => {
        const cameraId = Number(camera?.id);
        if (!Number.isFinite(cameraId) || cameraId < 1) {
            return;
        }

        setActiveChannel(`ch${cameraId}`);
    }, [setActiveChannel]);

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

    const unconnectedChannels = useStore((state) => state.unconnectedChannels);

    return {
        activeCamera,
        setActiveCamera,
        cameras: normalizedCameras,
        cameraSnapshot,
        onlineChannels,
        unconnectedChannels,
        events,
        isFullscreen,
        setIsFullscreen,
        currentDateTime,
        playerRef,
        stats,
        isLoading: isLoadingCameras,
        error: cameraError,
        handleToggleFullscreen,
    };
};
