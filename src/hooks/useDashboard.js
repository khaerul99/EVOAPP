import { useState, useEffect, useRef } from 'react';

const INITIAL_CAMERAS = [
    { id: 1, name: 'Lobby Utama - Unit A1', status: 'Online', ip: '192.168.1.101', thumbnail: 'https://images.unsplash.com/photo-1497366811353-6870744d04b2?auto=format&fit=crop&w=800&q=80' },
    { id: 2, name: 'Area Parkir Timur', status: 'Online', ip: '192.168.1.102', thumbnail: 'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&w=800&q=80' },
    { id: 3, name: 'Ruang Server Tier 3', status: 'Offline', ip: '192.168.1.105', thumbnail: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=800&q=80' },
];

const INITIAL_EVENTS = [
    { id: 1, type: 'Face Recognized', camera: 'Lobby Utama', time: '10:15:30', detail: 'User: Ryujin (Staff)', severity: 'info' },
    { id: 2, type: 'People Count Detected', camera: 'Area Parkir', time: '10:14:02', detail: '4 people detected', severity: 'info' },
    { id: 3, type: 'Camera Offline', camera: 'Ruang Server', time: '10:12:45', detail: 'Connection lost (IVSS Error)', severity: 'warning' },
    { id: 4, type: 'Face Detected', camera: 'Pintu Keluar', time: '10:10:12', detail: 'Unknown face detected', severity: 'info' },
    { id: 5, type: 'System Reboot', camera: 'Gateway 1', time: '09:00:00', detail: 'Scheduled maintenance', severity: 'success' },
];

export const useDashboard = () => {
    const [activeCamera, setActiveCamera] = useState(INITIAL_CAMERAS[0]);
    const [cameras] = useState(INITIAL_CAMERAS);
    const [events, setEvents] = useState(INITIAL_EVENTS);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [currentDateTime, setCurrentDateTime] = useState(new Date());
    const playerRef = useRef(null);
    const [stats, setStats] = useState({
        peopleCount: 124,
        faceDetected: 86,
        faceRecognized: 42,
        totalCams: 18,
        onlineCams: 15,
        offlineCams: 3
    });

    useEffect(() => {
        const clockTimer = setInterval(() => setCurrentDateTime(new Date()), 1000);
        return () => clearInterval(clockTimer);
    }, []);

    useEffect(() => {
        const timer = setInterval(() => {
            setStats(prev => ({
                ...prev,
                peopleCount: prev.peopleCount + (Math.random() > 0.8 ? 1 : 0),
                faceDetected: prev.faceDetected + (Math.random() > 0.9 ? 1 : 0),
                faceRecognized: prev.faceRecognized + (Math.random() > 0.95 ? 1 : 0),
            }));

            if (Math.random() > 0.97) {
                const newEvent = {
                    id: Date.now(),
                    type: ['Face Detected', 'People Count Detected', 'Camera Online'][Math.floor(Math.random() * 3)],
                    camera: activeCamera.name,
                    time: new Date().toLocaleTimeString('id-ID'),
                    detail: 'Auto-refreshed security event',
                    severity: 'info'
                };
                setEvents(prev => [newEvent, ...prev.slice(0, 4)]);
            }
        }, 3000);

        return () => clearInterval(timer);
    }, [activeCamera.name]);

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
            } else {
                if (document.exitFullscreen) {
                    await document.exitFullscreen();
                }
            }
        } catch (error) {
            console.error('Fullscreen error:', error);
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
        handleToggleFullscreen
    };
};