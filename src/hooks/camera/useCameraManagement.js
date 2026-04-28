import { useCallback, useEffect, useMemo, useState } from 'react';
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

export function useCameraManagement() {
    const [cameras, setCameras] = useState([]);
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
            const channelData = await cameraService.getCameraChannels();
            setCameras(Array.isArray(channelData) ? channelData : []);
            setError('');
            setIsDigestRetrying(false);
        } catch (requestError) {
            const statusCode = requestError?.response?.status;
            const isDigestInProgress = statusCode === 401;

            if (isDigestInProgress) {
                setIsDigestRetrying(true);
                setError('Sedang menunggu autentikasi digest. Data kamera akan dimuat otomatis.');
                return 'digest';
            }

            setCameras([]);
            setIsDigestRetrying(false);
            if (statusCode === 403) {
                setError('Akses ditolak (403) untuk data kamera pada akun ini.');
            } else {
                setError('Gagal mengambil data kamera dari perangkat.');
            }
            return 'error';
        }

        return 'ok';
    }, []);

    
    
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
        setCameras((previous) => previous.map((camera) => camera.id === editCamera?.id ? editCamera : camera));
        setEditCamera(null);
    }, [editCamera]);

    const handleConfirmDelete = useCallback(() => {
        setCameras((previous) => previous.filter((camera) => camera.id !== deleteCameraId));
        setDeleteCameraId(null);
    }, [deleteCameraId]);

    return {
        cameras,
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
