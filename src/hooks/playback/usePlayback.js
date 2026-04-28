import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import Hls from 'hls.js';
import { cameraService } from '../../services/camera/camera.service';
import { playbackService } from '../../services/playback/playback.service';

function toLocalDateInputValue(date) {
    const value = new Date(date);
    if (Number.isNaN(value.getTime())) {
        return '';
    }

    const local = new Date(value.getTime() - value.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 10);
}

function toLocalDateTimeInputValue(date) {
    const value = new Date(date);
    if (Number.isNaN(value.getTime())) {
        return '';
    }

    const local = new Date(value.getTime() - value.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 16);
}

function parseCameraDateTime(value) {
    const text = String(value || '').trim();
    if (!text) {
        return null;
    }

    const normalized = text.replace(' ', 'T');
    const parsed = new Date(normalized);
    if (!Number.isNaN(parsed.getTime())) {
        return parsed;
    }

    const direct = new Date(text);
    if (!Number.isNaN(direct.getTime())) {
        return direct;
    }

    return null;
}

function isRtspAuthFailure(message) {
    const normalized = String(message || '').toLowerCase();
    return /wrong\s*user\/?pass|wrong\s*password|unauthorized|forbidden|auth(?:entication)?\s*fail|\b401\b|\b403\b/.test(normalized);
}

export function formatRecordingLabel(value) {
    const parsed = parseCameraDateTime(value);
    if (!parsed) {
        return String(value || '-');
    }

    const day = String(parsed.getDate()).padStart(2, '0');
    const month = String(parsed.getMonth() + 1).padStart(2, '0');
    const year = parsed.getFullYear();
    const hour = String(parsed.getHours()).padStart(2, '0');
    const minute = String(parsed.getMinutes()).padStart(2, '0');
    const second = String(parsed.getSeconds()).padStart(2, '0');
    return `${day}/${month}/${year} ${hour}:${minute}:${second}`;
}

export function formatRecordingDuration(beginTime, endTime) {
    const begin = parseCameraDateTime(beginTime);
    const end = parseCameraDateTime(endTime);
    if (!begin || !end) {
        return '-';
    }

    const totalSeconds = Math.max(0, Math.round((end.getTime() - begin.getTime()) / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
        return `${hours}j ${String(minutes).padStart(2, '0')}m ${String(seconds).padStart(2, '0')}d`;
    }
    return `${minutes}m ${String(seconds).padStart(2, '0')}d`;
}

function getTransportLabel(mode, activePlayerType, hasHlsUrl, hasIframeUrl) {
    if (activePlayerType === 'hls') {
        return mode === 'live' ? 'HLS (Live)' : 'HLS (Playback)';
    }

    if (activePlayerType === 'iframe') {
        return mode === 'live' ? 'go2rtc WebRTC/MSE' : 'go2rtc MSE';
    }

    if (hasHlsUrl) {
        return 'HLS tersedia';
    }

    if (hasIframeUrl) {
        return 'go2rtc player tersedia';
    }

    return 'Belum aktif';
}

function createInitialForm() {
    const now = new Date();
    const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000);

    return {
        selectedDate: toLocalDateInputValue(now),
        channel: '1',
        subtype: '0',
        starttime: toLocalDateTimeInputValue(tenMinutesAgo),
        endtime: toLocalDateTimeInputValue(now),
    };
}

export function usePlayback() {
    const videoRef = useRef(null);
    const location = useLocation();
    const didApplyQueryRef = useRef(false);
    const pendingAutoStartRef = useRef(false);

    const [channels, setChannels] = useState([]);
    const [isLoadingChannels, setIsLoadingChannels] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [playerError, setPlayerError] = useState('');
    const [streamSources, setStreamSources] = useState(null);
    const [lastAttemptSources, setLastAttemptSources] = useState(null);
    const [isHlsReady, setIsHlsReady] = useState(false);
    const [playbackRenderMode, setPlaybackRenderMode] = useState('player');
    const [go2rtcDiagnostic, setGo2rtcDiagnostic] = useState('');
    const [manifestCodecs, setManifestCodecs] = useState('');
    const [recordings, setRecordings] = useState([]);
    const [isLoadingRecordings, setIsLoadingRecordings] = useState(false);
    const [recordingError, setRecordingError] = useState('');
    const [selectedRecordingKey, setSelectedRecordingKey] = useState('');
    const [form, setForm] = useState(() => createInitialForm());

    useEffect(() => {
        let cancelled = false;

        const loadChannels = async () => {
            setIsLoadingChannels(true);
            try {
                const rows = await cameraService.getCameraChannels();
                if (cancelled) {
                    return;
                }

                const normalizedRows = Array.isArray(rows) ? rows : [];
                const activeRows = normalizedRows.filter(
                    (channel) => String(channel?.status || '').toLowerCase() === 'online',
                );

                setChannels(activeRows);
                if (activeRows.length > 0) {
                    setForm((previous) => ({
                        ...previous,
                        channel: String(activeRows[0].id || 1),
                    }));
                    setError('');
                } else {
                    setError('Tidak ada channel/device yang aktif saat ini.');
                }
            } catch {
                if (!cancelled) {
                    setError('Gagal mengambil daftar channel kamera (401). Anda tetap bisa mencoba stream manual per channel.');
                }
            } finally {
                if (!cancelled) {
                    setIsLoadingChannels(false);
                }
            }
        };

        // DISABLED: Prevent automatic playback channel loading during auth testing
        loadChannels();

        return () => {
            cancelled = true;
        };
        // Uncomment above to enable channel loading
    }, []);

    const selectedChannel = useMemo(
        () => channels.find((channel) => String(channel.id) === String(form.channel)),
        [channels, form.channel],
    );

    const channelOptions = useMemo(() => {
        if (channels.length > 0) {
            return channels.map((channel) => ({
                id: String(channel.id),
                label: `${channel.id}. ${channel.channelName || channel.name}`,
            }));
        }

        return Array.from({ length: 16 }, (_, index) => ({
            id: String(index + 1),
            label: `${index + 1}. Channel ${index + 1}`,
        }));
    }, [channels]);

    const resolvedHlsUrl = streamSources?.hlsUrl || '';
    const resolvedPlaybackPlayerUrl = streamSources?.playbackPlayerUrl || '';
    const iframeUrl = resolvedPlaybackPlayerUrl;
    const isHevcStream = /(^|,)\s*(hvc1|hev1)\b/i.test(String(manifestCodecs || ''));

    const forcePlaybackHls = playbackRenderMode === 'hls';
    const preferPlaybackIframe = playbackRenderMode !== 'hls';
    const shouldUseIframe = Boolean(iframeUrl) && (!resolvedHlsUrl || isHevcStream || preferPlaybackIframe) && !forcePlaybackHls;
    const shouldUseHls = Boolean(resolvedHlsUrl) && !shouldUseIframe;

    const activePlayerType = shouldUseHls ? 'hls' : (shouldUseIframe ? 'iframe' : 'none');
    const activeTransportLabel = useMemo(
        () => getTransportLabel('playback', activePlayerType, Boolean(resolvedHlsUrl), Boolean(iframeUrl)),
        [activePlayerType, iframeUrl, resolvedHlsUrl],
    );
    const activeSourceInfo = streamSources || lastAttemptSources;

    useEffect(() => {
        const video = videoRef.current;
        if (!video) {
            return undefined;
        }

        if (!shouldUseHls || !resolvedHlsUrl || !isHlsReady) {
            video.pause();
            video.removeAttribute('src');
            video.load();
            return undefined;
        }

        setPlayerError('');

        if (video.canPlayType('application/vnd.apple.mpegurl')) {
            video.src = resolvedHlsUrl;
            video.play().catch(() => {});
            return undefined;
        }

        if (!Hls.isSupported()) {
            setPlayerError('Browser ini tidak mendukung HLS. Gunakan browser modern atau player go2rtc.');
            return undefined;
        }

        const hls = new Hls({
            lowLatencyMode: false,
            backBufferLength: 45,
            maxBufferLength: 18,
            maxMaxBufferLength: 36,
            liveSyncDurationCount: 4,
            liveMaxLatencyDurationCount: 8,
            fragLoadingMaxRetry: 5,
            manifestLoadingMaxRetry: 4,
            enableWorker: true,
        });

        hls.loadSource(resolvedHlsUrl);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
            video.play().catch(() => {});
        });
        hls.on(Hls.Events.ERROR, (_, data) => {
            if (!data?.fatal) {
                return;
            }

            if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
                hls.startLoad();
                setPlayerError('Koneksi stream sempat terganggu, mencoba menyambung ulang...');
                return;
            }

            if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
                hls.recoverMediaError();
                setPlayerError('Player mencoba memulihkan error media...');
                return;
            }

            setPlayerError('Gagal memuat stream HLS. Coba klik Start Stream lagi.');
        });

        return () => {
            hls.destroy();
            video.pause();
            video.removeAttribute('src');
            video.load();
        };
    }, [isHlsReady, resolvedHlsUrl, shouldUseHls]);

    useEffect(() => {
        if (playbackRenderMode !== 'hls') {
            return undefined;
        }

        const timer = setTimeout(() => {
            const video = videoRef.current;
            if (!video) {
                return;
            }
            if (video.currentTime < 0.1) {
                setPlayerError('Playback HLS belum mulai. Coba mode "Playback Render: Player" untuk kompatibilitas lebih tinggi.');
            }
        }, 8000);

        return () => {
            clearTimeout(timer);
        };
    }, [playbackRenderMode, streamSources]);

    const updateField = (key, value) => {
        setForm((previous) => ({
            ...previous,
            [key]: value,
        }));
    };

    const buildSources = useCallback(() => {
        if (!form.channel) {
            throw new Error('Channel wajib dipilih.');
        }

        const hasLoadedChannels = channels.length > 0;
        const isSelectedChannelActive = channels.some(
            (channel) => String(channel.id) === String(form.channel),
        );
        if (hasLoadedChannels && !isSelectedChannelActive) {
            throw new Error('Channel aktif tidak ditemukan. Pilih channel yang tersedia.');
        }

        const startDate = new Date(form.starttime);
        const endDate = new Date(form.endtime);
        const nowDate = new Date();
        if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || endDate <= startDate) {
            throw new Error('Pastikan rentang waktu playback valid.');
        }
        if (startDate > nowDate || endDate > nowDate) {
            throw new Error('Waktu playback tidak boleh melebihi waktu saat ini.');
        }

        return playbackService.buildPlaybackStreamSources({
            channel: form.channel,
            subtype: form.subtype,
            starttime: form.starttime,
            endtime: form.endtime,
        });
    }, [channels, form.channel, form.endtime, form.starttime, form.subtype]);

    const readGo2rtcDiagnostic = useCallback(async (streamName) => {
        if (!streamName) {
            return '';
        }

        try {
            const allStreams = await playbackService.getGo2rtcStreams();
            const streamInfo = Array.isArray(allStreams)
                ? allStreams.find((entry) => entry?.name === streamName || entry?.id === streamName)
                : allStreams?.[streamName];
            const producers = Array.isArray(streamInfo?.producers) ? streamInfo.producers : [];
            const errorProducer = producers.find((producer) => producer?.error || producer?.msg);
            return String(errorProducer?.error || errorProducer?.msg || '');
        } catch {
            return '';
        }
    }, []);

    const handleFindRecordings = useCallback(async () => {
        if (!form.channel || !form.selectedDate) {
            setRecordingError('Pilih tanggal dan channel dulu.');
            return;
        }

        const [year, month, day] = form.selectedDate.split('-').map(Number);
        if (!year || !month || !day) {
            setRecordingError('Format tanggal tidak valid.');
            return;
        }

        const dayStart = new Date(year, month - 1, day, 0, 0, 0, 0);
        const dayEnd = new Date(year, month - 1, day, 23, 59, 59, 999);

        setIsLoadingRecordings(true);
        setRecordingError('');
        setSelectedRecordingKey('');

        try {
            const rows = await playbackService.findPlaybackRecordings({
                channel: form.channel,
                subtype: form.subtype,
                dayStart,
                dayEnd,
                maxItems: 300,
            });

            if (!Array.isArray(rows) || rows.length === 0) {
                setRecordings([]);
                setRecordingError('Belum ada rekaman pada tanggal/channel ini.');
                return;
            }

            setRecordings(rows);
        } catch (requestError) {
            setRecordings([]);
            const detail = requestError?.message;
            setRecordingError(detail ? `Gagal mengambil daftar rekaman: ${detail}` : 'Gagal mengambil daftar rekaman.');
        } finally {
            setIsLoadingRecordings(false);
        }
    }, [form.channel, form.selectedDate, form.subtype]);

    const applyRecordingWindow = useCallback((record) => {
        const begin = parseCameraDateTime(record?.beginTime);
        const end = parseCameraDateTime(record?.endTime);
        if (!begin || !end) {
            return;
        }

        setForm((previous) => ({
            ...previous,
            selectedDate: toLocalDateInputValue(begin),
            starttime: toLocalDateTimeInputValue(begin),
            endtime: toLocalDateTimeInputValue(end),
        }));
    }, []);

    const handleStartStream = useCallback(async () => {
        setError('');
        setPlayerError('');
        setGo2rtcDiagnostic('');
        setManifestCodecs('');
        setIsHlsReady(false);

        setIsSubmitting(true);
        try {
            const sources = buildSources();
            const rtspCandidates = [
                sources.rtspUrl,
                ...(Array.isArray(sources.rtspFallbackUrls) ? sources.rtspFallbackUrls : []),
            ].filter(Boolean);

            let selectedSources = sources;
            let selectedHlsReady = false;
            let selectedManifestRaw = '';
            let selectedCodecs = '';
            let selectedDiagnostic = '';
            let hasSelectedResult = false;

            for (let attemptIndex = 0; attemptIndex < rtspCandidates.length; attemptIndex += 1) {
                const candidateRtspUrl = rtspCandidates[attemptIndex];
                const candidateSources = {
                    ...sources,
                    rtspUrl: candidateRtspUrl,
                };
                setLastAttemptSources(candidateSources);

                try {
                    await playbackService.ensureGo2rtcStream({
                        streamName: candidateSources.streamName,
                        rtspUrl: candidateRtspUrl,
                    });
                } catch (registrationError) {
                    if (!selectedDiagnostic) {
                        selectedDiagnostic = String(registrationError?.message || registrationError || '');
                    }
                }

                const shouldProbeHls = Boolean(candidateSources.hlsUrl) && (
                    candidateSources.mode === 'playback' && (playbackRenderMode === 'hls' || !candidateSources.playbackPlayerUrl)
                );
                let candidateHlsReady = Boolean(candidateSources.hlsUrl) && !shouldProbeHls;
                let candidateManifestRaw = '';
                if (shouldProbeHls) {
                    candidateHlsReady = await playbackService.waitForHlsReady({
                        hlsUrl: candidateSources.hlsUrl,
                        timeoutMs: 9000,
                        intervalMs: 450,
                    });
                }

                let candidateCodecs = '';
                if (candidateSources.hlsUrl) {
                    try {
                        const manifestResponse = await fetch(candidateSources.hlsUrl, {
                            cache: 'no-store',
                            headers: {
                                'Cache-Control': 'no-cache, no-store',
                                Pragma: 'no-cache',
                            },
                        });
                        if (manifestResponse.ok) {
                            const manifestText = await manifestResponse.text();
                            candidateManifestRaw = manifestText;
                            const codecMatch = manifestText.match(/CODECS=\"([^\"]+)\"/i);
                            candidateCodecs = codecMatch?.[1] || '';
                        }
                    } catch {
                        // Ignore codec parse failures.
                    }
                }

                if (!shouldProbeHls) {
                    await new Promise((resolve) => {
                        setTimeout(resolve, 450);
                    });
                }

                const candidateDiagnostic = await readGo2rtcDiagnostic(candidateSources.streamName);
                const hasDescribeFailure = /wrong response on describe|401|403|404|no such file|not found/i.test(
                    String(candidateDiagnostic || '').toLowerCase(),
                );
                const hasAuthFailure = isRtspAuthFailure(candidateDiagnostic);

                if (hasAuthFailure) {
                    throw new Error('Autentikasi RTSP ditolak (401/403). Periksa VITE_RTSP_USERNAME dan VITE_RTSP_PASSWORD atau stream statis di go2rtc.yaml agar akun tidak terkunci.');
                }

                const shouldUseCandidate = shouldProbeHls
                    ? candidateHlsReady
                    : !hasDescribeFailure;
                const isLastCandidate = attemptIndex >= rtspCandidates.length - 1;

                if (shouldUseCandidate || isLastCandidate) {
                    selectedSources = candidateSources;
                    selectedHlsReady = candidateHlsReady;
                    selectedManifestRaw = candidateManifestRaw;
                    selectedCodecs = candidateCodecs;
                    selectedDiagnostic = candidateDiagnostic;
                    hasSelectedResult = true;
                    break;
                }
            }

            if (!hasSelectedResult) {
                throw new Error('Gagal menyiapkan kandidat playback stream.');
            }

            setManifestCodecs(selectedCodecs);
            setStreamSources(selectedSources);
            setIsHlsReady(selectedHlsReady);
            if (selectedDiagnostic) {
                setGo2rtcDiagnostic(selectedDiagnostic);
            }

            if (selectedSources.mode === 'playback' && selectedSources.hlsUrl && !selectedHlsReady) {
                setPlayerError('Playlist playback belum siap. Coba klik Start Stream sekali lagi dalam 2-3 detik.');
            }
            if (selectedSources.mode === 'playback' && selectedSources.hlsUrl && !String(selectedManifestRaw || '').trim()) {
                setPlayerError('Playlist playback kosong dari perangkat. Kemungkinan tidak ada rekaman pada rentang waktu yang dipilih.');
            }
            if (/(^|,)\s*(hvc1|hev1)\b/i.test(String(selectedCodecs || ''))) {
                setPlayerError('Codec stream terdeteksi H.265/HEVC. Jika video tetap hitam di browser, pakai VLC dengan RTSP URL atau aktifkan transcoding ke H.264.');
            }
        } catch (requestError) {
            const detail = requestError?.message;
            setError(detail ? `Gagal menyiapkan stream: ${detail}` : 'Gagal menyiapkan stream.');
        } finally {
            setIsSubmitting(false);
        }
    }, [buildSources, playbackRenderMode, readGo2rtcDiagnostic]);

    useEffect(() => {
        if (didApplyQueryRef.current) {
            return;
        }

        const searchParams = new URLSearchParams(location.search || '');
        const channel = String(searchParams.get('channel') || '').trim();
        const subtype = String(searchParams.get('subtype') || '').trim();
        const starttime = String(searchParams.get('starttime') || '').trim();
        const endtime = String(searchParams.get('endtime') || '').trim();
        const autoplay = String(searchParams.get('autoplay') || '').trim();

        if (!channel && !starttime && !endtime) {
            return;
        }

        didApplyQueryRef.current = true;
        setForm((previous) => ({
            ...previous,
            ...(channel ? { channel } : {}),
            ...(subtype ? { subtype } : {}),
            ...(starttime ? { starttime } : {}),
            ...(endtime ? { endtime } : {}),
        }));

        pendingAutoStartRef.current = autoplay === '1' || autoplay.toLowerCase() === 'true';
    }, [location.search]);

    useEffect(() => {
        if (!pendingAutoStartRef.current) {
            return;
        }

        pendingAutoStartRef.current = false;
        handleStartStream().catch(() => {});
    }, [handleStartStream, form.channel, form.endtime, form.starttime, form.subtype]);

    useEffect(() => {
        if (!form.selectedDate) {
            return;
        }

        const [year, month, day] = form.selectedDate.split('-').map(Number);
        if (!year || !month || !day) {
            return;
        }

        const applySelectedDate = (currentValue) => {
            const currentDate = new Date(currentValue);
            if (Number.isNaN(currentDate.getTime())) {
                return currentValue;
            }

            const updatedDate = new Date(currentDate);
            updatedDate.setFullYear(year, month - 1, day);
            return toLocalDateTimeInputValue(updatedDate);
        };

        setForm((previous) => ({
            ...previous,
            starttime: applySelectedDate(previous.starttime),
            endtime: applySelectedDate(previous.endtime),
        }));
    }, [form.selectedDate]);

    return {
        videoRef,
        form,
        updateField,
        selectedChannel,
        channelOptions,
        isLoadingChannels,
        isSubmitting,
        error,
        playerError,
        streamSources,
        activeSourceInfo,
        shouldUseHls,
        shouldUseIframe,
        iframeUrl,
        activeTransportLabel,
        playbackRenderMode,
        setPlaybackRenderMode,
        recordings,
        isLoadingRecordings,
        recordingError,
        selectedRecordingKey,
        setSelectedRecordingKey,
        manifestCodecs,
        go2rtcDiagnostic,
        handleFindRecordings,
        applyRecordingWindow,
        handleStartStream,
    };
}
