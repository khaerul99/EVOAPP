import { useCallback, useEffect, useMemo, useState } from 'react';
import { useStore } from '../../stores/useStore';
import { cameraService } from '../../services/camera/camera.service';

const INITIAL_NEW_CAMERA = {
    type: 'oneByOne',
    channelMode: 'auto',
    channelIndex: '0',
    manufacturer: 'Private',
    ipAddress: '192.168.1.108',
    tcpPort: '37777',
    username: 'admin',
    password: 'admin123',
    connectionType: 'Self-adaptive',
    cacheMethod: 'Self-adaptive',
    totalChannels: '1',
    channelRangeStart: '1',
    channelRangeEnd: '1',
};

function normalizeText(value) {
    return String(value || '').toLowerCase();
}

function createInitialNewCamera() {
    return { ...INITIAL_NEW_CAMERA };
}

function getNextAvailableChannelIndex(cameras) {
    const usedIndexes = new Set(
        cameras
            .map((camera) => Number(camera.id))
            .filter((value) => Number.isFinite(value) && value > 0)
            .map((value) => value - 1),
    );

    let candidate = 0;
    while (usedIndexes.has(candidate)) {
        candidate += 1;
    }

    return candidate;
}

function buildOnlineChannels(rows = []) {
    return (Array.isArray(rows) ? rows : [])
        .filter((row) => String(row?.status || '').toLowerCase() === 'online')
        .map((row) => ({
            id: `ch${row.id}`,
            label: `${row.id} - ${row.channelName || row.name || `Channel ${row.id}`}`,
            ip: row.ip || '-',
        }));
}

function buildStatusByChannel(rows = []) {
    return (Array.isArray(rows) ? rows : []).reduce((accumulator, row) => {
        const channelId = Number(row?.id);
        if (!Number.isFinite(channelId) || channelId < 1) {
            return accumulator;
        }

        accumulator[`ch${channelId}`] = {
            status: String(row?.status || 'unknown').toLowerCase(),
            record: Boolean(row?.record),
            statusMessage: String(row?.statusMessage || ''),
            ip: String(row?.ip || ''),
        };
        return accumulator;
    }, {});
}

function buildRecordByChannel(rows = []) {
    return (Array.isArray(rows) ? rows : []).reduce((accumulator, row) => {
        const channelId = Number(row?.id);
        if (!Number.isFinite(channelId) || channelId < 1) {
            return accumulator;
        }

        accumulator[`ch${channelId}`] = Boolean(row?.record);
        return accumulator;
    }, {});
}

export function useCameraManagement() {
    const cameras = useStore((state) => state.cameras);
    const onlineChannels = useStore((state) => state.onlineChannels);
    const activeChannel = useStore((state) => state.activeChannel);
    const fetchCameras = useStore((state) => state.fetchCameras);
    const setActiveChannel = useStore((state) => state.setActiveChannel);
    const [currentPage, setCurrentPage] = useState(1);
    const [isAddPopupOpen, setIsAddPopupOpen] = useState(false);
    const [editCamera, setEditCamera] = useState(null);
    const [deleteCameraId, setDeleteCameraId] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [viewMode, setViewMode] = useState('layout');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [isDigestRetrying, setIsDigestRetrying] = useState(false);
    const [newCamera, setNewCamera] = useState(createInitialNewCamera);

    const loadCameras = useCallback(async () => {
        try {
            console.log('[useCameraManagement.loadCameras] Starting...');
            const normalizedRows = await fetchCameras();
            console.log('[useCameraManagement.loadCameras] Received rows:', normalizedRows.length);

            normalizedRows.forEach((row, idx) => {
                console.log(`[useCameraManagement.loadCameras] Row ${idx}:`, {
                    id: row.id,
                    name: row.name,
                    status: row.status,
                    record: row.record,
                    ip: row.ip,
                });
            });

            console.log('[useCameraManagement.loadCameras] Online channels:', useStore.getState().onlineChannels.length, useStore.getState().onlineChannels);
            setError('');
            setIsDigestRetrying(false);
            console.log('[useCameraManagement.loadCameras] Success! Store updated.');
        } catch (requestError) {
            console.error('[useCameraManagement.loadCameras] Error:', requestError);
            const statusCode = requestError?.response?.status;
            const isDigestInProgress = statusCode === 401;

            if (isDigestInProgress) {
                setIsDigestRetrying(true);
                setError('Sedang menunggu autentikasi digest. Data kamera akan dimuat otomatis.');
                useStore.setState({
                    isLoadingChannels: true,
                    isLoadingCameras: true,
                    channelError: 'Sedang menunggu autentikasi digest. Data kamera akan dimuat otomatis.',
                    cameraError: 'Sedang menunggu autentikasi digest. Data kamera akan dimuat otomatis.',
                });
                return 'digest';
            }

            setIsDigestRetrying(false);
            if (statusCode === 403) {
                setError('Akses ditolak (403) untuk data kamera pada akun ini.');
            } else {
                setError('Gagal mengambil data kamera dari perangkat.');
            }
            return 'error';
        }

        return 'ok';
    }, [fetchCameras]);

    
    
    useEffect(() => {
        let cancelled = false;

        const fetchChannels = async () => {
            const status = await loadCameras();
            if (cancelled) {
                return;
            }

            if (status === 'digest') {
                setLoading(true);
                setLoading(false);
                return;
            }

            setLoading(false);
        };

        setLoading(true);
        fetchChannels();

        return () => {
            cancelled = true;
        };
    }, [loadCameras]);
    

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm]);

    const filteredCameras = useMemo(() => {
        const normalizedSearch = normalizeText(searchTerm);
        return cameras.filter((camera) => {
            const normalizedStatus = normalizeText(camera.status);
            const shouldShowByStatus = normalizedStatus === 'online' || normalizedStatus === 'offline';
            if (!shouldShowByStatus) {
                return false;
            }

            return normalizeText(camera.name).includes(normalizedSearch)
                || normalizeText(camera.deviceName).includes(normalizedSearch)
                || normalizeText(camera.ip).includes(normalizedSearch)
                || normalizeText(camera.manufacture).includes(normalizedSearch)
                || normalizeText(camera.model).includes(normalizedSearch)
                || normalizeText(camera.sn).includes(normalizedSearch);
        });
    }, [cameras, searchTerm]);

    const itemsPerPage = 10;
    const totalPages = Math.ceil(filteredCameras.length / itemsPerPage) || 1;
    const safeCurrentPage = Math.min(currentPage, totalPages);
    const paginatedCameras = filteredCameras.slice((safeCurrentPage - 1) * itemsPerPage, safeCurrentPage * itemsPerPage);

    const resetNewCamera = useCallback(() => {
        setNewCamera(createInitialNewCamera());
    }, []);

    const openAddPopup = useCallback(() => {
        resetNewCamera();
        setIsAddPopupOpen(true);
    }, [resetNewCamera]);

    const closeAddPopup = useCallback(() => {
        setIsAddPopupOpen(false);
        resetNewCamera();
    }, [resetNewCamera]);

    const getAddPayload = useCallback(() => {
        const resolvedChannelIndex = newCamera.channelMode === 'manual'
            ? Math.max(0, Number(newCamera.channelIndex) || 0)
            : getNextAvailableChannelIndex(cameras);

        return {
            channelIndex: resolvedChannelIndex,
            ipAddress: newCamera.ipAddress,
            port: newCamera.tcpPort,
            username: newCamera.username,
            password: newCamera.password,
            protocol: newCamera.manufacturer,
        };
    }, [cameras, newCamera]);

    const handleAddSubmit = useCallback(async (event) => {
        event.preventDefault();

        try {
            await cameraService.addRemoteDevice(getAddPayload());
            await loadCameras();
            closeAddPopup();
            setCurrentPage(1);
        } catch {
            setError('Gagal menambahkan device ke perangkat. Cek kembali endpoint dan kredensial kamera.');
        }
    }, [closeAddPopup, getAddPayload, loadCameras]);

    const handleEditSubmit = useCallback((event) => {
        event.preventDefault();
        useStore.setState((previous) => {
            const nextCameras = previous.cameras.map((camera) => camera.id === editCamera?.id ? editCamera : camera);
            return {
                cameras: nextCameras,
                onlineChannels: buildOnlineChannels(nextCameras),
                cameraStatusByChannel: buildStatusByChannel(nextCameras),
                cameraRecordByChannel: buildRecordByChannel(nextCameras),
                cameraSnapshot: {
                    ...previous.cameraSnapshot,
                    cameras: nextCameras,
                    onlineChannels: buildOnlineChannels(nextCameras),
                    cameraStatusByChannel: buildStatusByChannel(nextCameras),
                    cameraRecordByChannel: buildRecordByChannel(nextCameras),
                },
            };
        });
        setEditCamera(null);
    }, [editCamera]);

    const handleConfirmDelete = useCallback(() => {
        useStore.setState((previous) => {
            const nextCameras = previous.cameras.filter((camera) => camera.id !== deleteCameraId);
            return {
                cameras: nextCameras,
                onlineChannels: buildOnlineChannels(nextCameras),
                cameraStatusByChannel: buildStatusByChannel(nextCameras),
                cameraRecordByChannel: buildRecordByChannel(nextCameras),
                cameraSnapshot: {
                    ...previous.cameraSnapshot,
                    cameras: nextCameras,
                    onlineChannels: buildOnlineChannels(nextCameras),
                    cameraStatusByChannel: buildStatusByChannel(nextCameras),
                    cameraRecordByChannel: buildRecordByChannel(nextCameras),
                },
            };
        });
        setDeleteCameraId(null);
    }, [deleteCameraId]);

    return {
        cameras,
        onlineChannels,
        activeChannel,
        currentPage,
        setCurrentPage,
        isAddPopupOpen,
        openAddPopup,
        closeAddPopup,
        editCamera,
        setEditCamera,
        deleteCameraId,
        setDeleteCameraId,
        searchTerm,
        setSearchTerm,
        viewMode,
        setViewMode,
        loading,
        error,
        isDigestRetrying,
        newCamera,
        setNewCamera,
        filteredCameras,
        itemsPerPage,
        totalPages,
        safeCurrentPage,
        paginatedCameras,
        handleAddSubmit,
        handleEditSubmit,
        handleConfirmDelete,
    };
}
