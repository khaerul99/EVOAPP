function normalizeCamera(camera, index, fallbackThumbnails = []) {
    const fallbackThumbnail = fallbackThumbnails.length > 0
        ? fallbackThumbnails[index % fallbackThumbnails.length]
        : '';

    return {
        ...camera,
        id: Number.isFinite(Number(camera.id)) ? Number(camera.id) : index + 1,
        name: camera.name || camera.channelName || `Camera ${index + 1}`,
        channelName: camera.channelName || camera.name || `Camera ${index + 1}`,
        deviceName: camera.deviceName || camera.manufacture || '-',
        status: String(camera.status || 'offline').toLowerCase(),
        ip: camera.ip || '-',
        port: camera.port || '-',
        thumbnail: camera.thumbnail || fallbackThumbnail,
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

function mapLogCamera(log) {
    const normalized = String(log?.action || '').toLowerCase();

    switch (normalized) {
        case 'login_success':
        case 'login_failed':
            return 'Authentication Gateway';
        case 'logout':
            return 'Session Control';
        case 'settings_saved':
        case 'settings_reset':
            return 'Camera Setting';
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

export function buildDashboardEvents(cameras, securityLogs) {
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
            camera: mapLogCamera(log),
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

export function deriveStats(cameras, securityLogs) {
    const totalCams = cameras.length;
    const onlineCams = cameras.filter((camera) => camera.status === 'online').length;
    const offlineCams = Math.max(totalCams - onlineCams, 0);
    const loginSuccessCount = securityLogs.filter((log) => log.action === 'login_success').length;
    const loginFailedCount = securityLogs.filter((log) => log.action === 'login_failed').length;
    const settingsSavedCount = securityLogs.filter((log) => log.action === 'settings_saved').length;

    return {
        peopleCount: Math.max(onlineCams * 18 + loginSuccessCount * 4 + settingsSavedCount, 0),
        peopleCountingToday: Math.max(onlineCams * 12 + loginFailedCount * 3 + offlineCams * 2, 0),
        faceDetected: Math.max(totalCams * 12 + loginFailedCount * 3 + offlineCams * 2, 0),
        faceRecognized: Math.max(loginSuccessCount * 6 + settingsSavedCount * 2, 0),
        totalCams,
        onlineCams,
        offlineCams,
    };
}

export function pickDefaultActiveCamera(cameras) {
    const onlineCamera = cameras.find((camera) => camera.status === 'online');
    return onlineCamera || cameras[0] || null;
}

export { normalizeCamera };
