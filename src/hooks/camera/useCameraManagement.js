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

const DEFAULT_NVR_TOTAL_SLOTS = 64;

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

function buildChannelOptions(cameras = []) {
    const usedByChannel = (Array.isArray(cameras) ? cameras : []).reduce((accumulator, camera) => {
        const channelNumber = Number(camera?.id);
        if (!Number.isFinite(channelNumber) || channelNumber < 1) {
            return accumulator;
        }

        accumulator[channelNumber] = camera;
        return accumulator;
    }, {});

    return Object.keys(usedByChannel)
        .map(Number)
        .filter((value) => Number.isFinite(value) && value > 0)
        .sort((left, right) => left - right)
        .map((channelNumber) => {
            const camera = usedByChannel[channelNumber];
            return {
                value: String(channelNumber),
                label: `Channel ${channelNumber} - ${camera.name || camera.channelName || 'Active'}`,
            };
        });
}

function toChannelOptions(channelNumbers = []) {
    return (Array.isArray(channelNumbers) ? channelNumbers : [])
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value) && value > 0)
        .sort((left, right) => left - right)
        .map((channelNumber) => ({
            value: String(channelNumber),
            label: `Channel ${channelNumber}`,
        }));
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
    const [showAddPassword, setShowAddPassword] = useState(false);
    const [emptyChannelOptions, setEmptyChannelOptions] = useState([]);
    const [manufacturerOptions, setManufacturerOptions] = useState([]);

    const channelOptions = useMemo(() => buildChannelOptions(cameras), [cameras]);
    const firstActiveChannelIndex = channelOptions[0]?.value || String(getNextAvailableChannelIndex(cameras) + 1);
    const firstEmptyChannelIndex = emptyChannelOptions[0]?.value || firstActiveChannelIndex;

    const loadEmptyChannelOptions = useCallback(async (slotCount = DEFAULT_NVR_TOTAL_SLOTS) => {
        const emptyChannels = await cameraService.getRemoteDeviceEmptyChannels(slotCount);
        const mapped = toChannelOptions(emptyChannels);
        setEmptyChannelOptions(mapped);
        return mapped;
    }, []);

    const loadManufacturerOptions = useCallback(async () => {
        try {
            const vendors = await cameraService.getRemoteDeviceManufacturers();
            const mapped = (Array.isArray(vendors) ? vendors : []).map((vendor) => ({
                value: vendor,
                label: vendor,
            }));
            setManufacturerOptions(mapped);
            return mapped;
        } catch {
            setManufacturerOptions([]);
            return [];
        }
    }, []);

    const loadCameras = useCallback(async () => {
        try {
            const normalizedRows = await fetchCameras();

            normalizedRows.forEach((row, idx) => {
                console.log(`[useCameraManagement.loadCameras] Row ${idx}:`, {
                    id: row.id,
                    name: row.name,
                    status: row.status,
                    record: row.record,
                    ip: row.ip,
                });
            });

            setError('');
            setIsDigestRetrying(false);
        } catch (requestError) {
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

    const openAddPopup = useCallback(async () => {
        resetNewCamera();
        setShowAddPassword(false);
        const slotCount = DEFAULT_NVR_TOTAL_SLOTS;
        const [remoteEmptyChannels] = await Promise.all([
            loadEmptyChannelOptions(slotCount),
            loadManufacturerOptions(),
        ]);
        const nextChannel = remoteEmptyChannels[0]?.value || firstActiveChannelIndex;
        setNewCamera((previous) => ({
            ...previous,
            channelMode: 'manual',
            channelIndex: nextChannel,
        }));
        setIsAddPopupOpen(true);
    }, [firstActiveChannelIndex, loadEmptyChannelOptions, loadManufacturerOptions, resetNewCamera]);

    const closeAddPopup = useCallback(() => {
        setIsAddPopupOpen(false);
        setShowAddPassword(false);
        setEmptyChannelOptions([]);
        resetNewCamera();
    }, [resetNewCamera]);

    const getAddDevicePayload = useCallback(() => {
        let resolvedChannelNumber;

        if (newCamera.channelMode === 'auto') {
            // Auto mode: always use first empty channel from available slots
            resolvedChannelNumber = Number(firstEmptyChannelIndex) || 1;
        } else {
            // Manual mode: use user-selected channel
            resolvedChannelNumber = Number(newCamera.channelIndex) || Number(firstEmptyChannelIndex) || 1;
        }

        const payload = {
            channelNumber: resolvedChannelNumber,
            ipAddress: newCamera.ipAddress,
            port: newCamera.tcpPort,
            username: newCamera.username,
            password: newCamera.password,
            protocol: newCamera.manufacturer,
        };
        
        console.log('[useCameraManagement] getAddDevicePayload result:', payload);
        return payload;
    }, [firstEmptyChannelIndex, newCamera]);

    const getBatchAddPayloads = useCallback(() => {
        const start = Math.max(1, Number(newCamera.channelRangeStart) || 1);
        const end = Math.max(start, Number(newCamera.channelRangeEnd) || start);

        return Array.from({ length: end - start + 1 }, (_, index) => ({
            channelNumber: start + index,
            ipAddress: newCamera.ipAddress,
            port: newCamera.tcpPort,
            username: newCamera.username,
            password: newCamera.password,
            protocol: newCamera.manufacturer,
        }));
    }, [newCamera]);

    const handleAddSubmit = useCallback(async (event) => {
        event.preventDefault();

        try {
            const payload = newCamera.type === 'batchAdd' ? getBatchAddPayloads() : getAddDevicePayload();
            console.log('[useCameraManagement] handleAddSubmit payload:', payload);
            
            if (newCamera.type === 'batchAdd') {
                await cameraService.addCameraDevices({ devices: payload });
            } else {
                await cameraService.addRemoteDevice(payload);
            }
            
            // Give NVR time to initialize the new device
            console.log('[useCameraManagement] Waiting for device initialization...');
            await new Promise(resolve => setTimeout(resolve, 1500));
            
            // Refresh camera list with fresh authentication
            await loadCameras();
            closeAddPopup();
            setCurrentPage(1);
        } catch (error) {
            console.error('[useCameraManagement] handleAddSubmit error:', {
                status: error?.response?.status,
                message: error?.message,
                response: error?.response?.data,
            });
            const errorMessage = error?.response?.status === 401 
                ? 'Autentikasi gagal (401). Coba refresh halaman atau login ulang.'
                : 'Gagal menambahkan device ke perangkat. Cek kembali endpoint dan kredensial kamera.';
            setError(errorMessage);
        }
    }, [closeAddPopup, getAddDevicePayload, getBatchAddPayloads, loadCameras, newCamera.type]);

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
        showAddPassword,
        setShowAddPassword,
        channelOptions,
        emptyChannelOptions,
        manufacturerOptions,
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
