import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Hls from 'hls.js';
import { cameraService } from '../../services/camera/camera.service';
import { cameraSettingsService } from '../../services/camera/camera-settings.service';
import { liveDetectionService } from '../../services/camera/live-detection.service';
import { liveService } from '../../services/live/live.service';
import { authStore } from '../../stores/authSlice';
import { filterChannelsByAction } from '../../lib/role-helper';

function isRtspAuthFailure(message) {
    const normalized = String(message || '').toLowerCase();
    return /wrong\s*user\/?pass|wrong\s*password|unauthorized|forbidden|auth(?:entication)?\s*fail|\b401\b|\b403\b/.test(normalized);
}

function getTransportLabel(activePlayerType, hasHlsUrl, hasIframeUrl) {
    if (activePlayerType === 'hls') {
        return 'HLS (Live)';
    }

    if (activePlayerType === 'iframe') {
        return 'go2rtc WebRTC/MSE';
    }

    if (hasHlsUrl) {
        return 'HLS tersedia';
    }

    if (hasIframeUrl) {
        return 'go2rtc player tersedia';
    }

    return 'Belum aktif';
}

function createInitialLiveForm() {
    return {
        channel: '1',
        subtype: '0',
    };
}

export function useLive() {
    const videoRef = useRef(null);
    const liveContainerRef = useRef(null);
    const autoPlaySignatureRef = useRef('');

    const [channels, setChannels] = useState([]);
    const [isLoadingChannels, setIsLoadingChannels] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [playerError, setPlayerError] = useState('');
    const [streamSources, setStreamSources] = useState(null);
    const [lastAttemptSources, setLastAttemptSources] = useState(null);
    const [isHlsReady, setIsHlsReady] = useState(false);
    const [liveRenderMode, setLiveRenderMode] = useState('auto');
    const [go2rtcDiagnostic, setGo2rtcDiagnostic] = useState('');
    const [manifestCodecs, setManifestCodecs] = useState('');
    const [form, setForm] = useState(() => createInitialLiveForm());
    const [authCooldownEndsAt, setAuthCooldownEndsAt] = useState(0);
    const [authCooldownRemainingSec, setAuthCooldownRemainingSec] = useState(0);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [detectionFeed, setDetectionFeed] = useState([]);
    const [detectionError, setDetectionError] = useState('');
    const detectionRequestInFlightRef = useRef(false);
    const detectionHistoryRef = useRef([]);
    const detectionThumbRef = useRef(new Map());
    const detectionAuthCooldownEndsAtRef = useRef(0);
    const detectionFailureCountRef = useRef(0);
    const detectionLastFetchAtRef = useRef(0);
    const detectionConsecutive401Ref = useRef(0);
    const detectionCropSemaphoreRef = useRef(0);
    const MAX_CONCURRENT_CROPS = 3;

    useEffect(() => {
        if (authCooldownEndsAt <= 0) {
            setAuthCooldownRemainingSec(0);
            return undefined;
        }

        const sync = () => {
            const remainingMs = Math.max(0, authCooldownEndsAt - Date.now());
            setAuthCooldownRemainingSec(Math.ceil(remainingMs / 1000));
            if (remainingMs <= 0) {
                setAuthCooldownEndsAt(0);
            }
        };

        sync();
        const timer = setInterval(sync, 500);
        return () => clearInterval(timer);
    }, [authCooldownEndsAt]);

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

                // Apply permission filter for Live view
                const authState = authStore.getState();
                const permitted = filterChannelsByAction(activeRows, authState, 'Live');

                setChannels(permitted);
                if (permitted.length > 0) {
                    setForm((previous) => ({
                        ...previous,
                        channel: String(permitted[0].id || 1),
                    }));
                    setError('');
                } else {
                    setForm((previous) => ({
                        ...previous,
                        channel: '',
                    }));
                    setError('Tidak ada channel/device yang aktif atau diizinkan untuk akun ini.');
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

        loadChannels();

        return () => {
            cancelled = true;
        };
    }, []);

    const selectedChannel = useMemo(
        () => channels.find((channel) => String(channel.id) === String(form.channel)),
        [channels, form.channel],
    );

    const channelOptions = useMemo(() => {
        return channels.map((channel) => ({
            id: String(channel.id),
            label: `${channel.id}. ${channel.channelName || channel.name}`,
        }));
    }, [channels]);

    const resolvedHlsUrl = streamSources?.hlsUrl || '';
    const iframeUrl = streamSources?.livePlayerUrl || '';
    const forceLiveHls = liveRenderMode === 'hls';
    const shouldUseIframe = Boolean(iframeUrl) && !forceLiveHls;
    const shouldUseHls = Boolean(resolvedHlsUrl) && (forceLiveHls || !shouldUseIframe);

    const activePlayerType = shouldUseHls ? 'hls' : (shouldUseIframe ? 'iframe' : 'none');
    const activeTransportLabel = useMemo(
        () => getTransportLabel(activePlayerType, Boolean(resolvedHlsUrl), Boolean(iframeUrl)),
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
            lowLatencyMode: true,
            backBufferLength: 8,
            maxBufferLength: 5,
            maxMaxBufferLength: 10,
            liveSyncDurationCount: 2,
            liveMaxLatencyDurationCount: 5,
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

            setPlayerError('Gagal memuat stream HLS. Sistem akan mencoba lagi saat konfigurasi channel berubah.');
        });

        return () => {
            hls.destroy();
            video.pause();
            video.removeAttribute('src');
            video.load();
        };
    }, [isHlsReady, resolvedHlsUrl, shouldUseHls]);

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

        return liveService.buildLiveStreamSources({
            channel: form.channel,
            subtype: form.subtype,
        });
    }, [channels, form.channel, form.subtype]);

    const readGo2rtcDiagnostic = useCallback(async (streamName) => {
        if (!streamName) {
            return '';
        }

        try {
            const allStreams = await liveService.getGo2rtcStreams();
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

    const handleStartStream = useCallback(async () => {
        if (authCooldownEndsAt > Date.now()) {
            const waitSeconds = Math.ceil((authCooldownEndsAt - Date.now()) / 1000);
            setError(`Percobaan live ditahan sementara untuk mencegah akun terkunci. Coba lagi ${waitSeconds} detik.`);
            return;
        }

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
                    await liveService.ensureGo2rtcStream({
                        streamName: candidateSources.streamName,
                        rtspUrl: candidateRtspUrl,
                    });
                } catch (registrationError) {
                    if (!selectedDiagnostic) {
                        selectedDiagnostic = String(registrationError?.message || registrationError || '');
                    }
                }

                const shouldProbeHls = Boolean(candidateSources.hlsUrl) && (liveRenderMode === 'hls' || !candidateSources.livePlayerUrl);
                let candidateHlsReady = Boolean(candidateSources.hlsUrl) && !shouldProbeHls;

                if (shouldProbeHls) {
                    try {
                        candidateHlsReady = await liveService.waitForHlsReady({
                            hlsUrl: candidateSources.hlsUrl,
                            timeoutMs: 5000,
                            intervalMs: 450,
                        });
                    } catch (probeError) {
                        setAuthCooldownEndsAt(Date.now() + 60000);
                        throw probeError;
                    }
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
                        if (!manifestResponse.ok) {
                            setAuthCooldownEndsAt(Date.now() + 60000);
                            throw new Error(`HLS manifest failed (${manifestResponse.status})`);
                        }
                        const manifestText = await manifestResponse.text();
                        const codecMatch = manifestText.match(/CODECS=\"([^\"]+)\"/i);
                        candidateCodecs = codecMatch?.[1] || '';
                    } catch (codecError) {
                        if (!codecError?.message?.includes('Ignore')) {
                            setAuthCooldownEndsAt(Date.now() + 60000);
                        }
                    }
                }

                const candidateDiagnostic = await readGo2rtcDiagnostic(candidateSources.streamName);
                if (isRtspAuthFailure(candidateDiagnostic)) {
                    setAuthCooldownEndsAt(Date.now() + 30000);
                    throw new Error('Autentikasi RTSP ditolak (401/403). Periksa VITE_RTSP_USERNAME dan VITE_RTSP_PASSWORD agar akun tidak terkunci.');
                }

                const hasDescribeFailure = /wrong response on describe|401|403|404|no such file|not found|i\/o timeout|timed out|deadline exceeded|connection refused|connection reset|eof/i.test(
                    String(candidateDiagnostic || '').toLowerCase(),
                );
                const shouldUseCandidate = shouldProbeHls
                    ? candidateHlsReady
                    : !hasDescribeFailure;
                const isLastCandidate = attemptIndex >= rtspCandidates.length - 1;

                if (shouldUseCandidate || isLastCandidate) {
                    selectedSources = candidateSources;
                    selectedHlsReady = candidateHlsReady;
                    selectedCodecs = candidateCodecs;
                    selectedDiagnostic = candidateDiagnostic;
                    hasSelectedResult = true;
                    break;
                }
            }

            if (!hasSelectedResult) {
                throw new Error('Gagal menyiapkan kandidat live stream.');
            }

            if (isRtspAuthFailure(selectedDiagnostic)) {
                setAuthCooldownEndsAt(Date.now() + 30000);
                throw new Error('Autentikasi RTSP ditolak (401/403). Periksa VITE_RTSP_USERNAME dan VITE_RTSP_PASSWORD agar akun tidak terkunci.');
            }

            setManifestCodecs(selectedCodecs);
            setStreamSources(selectedSources);
            setIsHlsReady(selectedHlsReady);
            if (selectedDiagnostic) {
                setGo2rtcDiagnostic(selectedDiagnostic);
            }

            if (selectedSources.hlsUrl && !selectedHlsReady) {
                setPlayerError('Playlist live belum siap. Menunggu sinkronisasi stream 2-3 detik.');
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
    }, [authCooldownEndsAt, buildSources, liveRenderMode, readGo2rtcDiagnostic]);

    useEffect(() => {
        if (isLoadingChannels || isSubmitting) {
            return;
        }

        if (!form.channel) {
            return;
        }

        if (authCooldownEndsAt > Date.now()) {
            return;
        }

        const signature = `${form.channel}|${form.subtype}|${liveRenderMode}`;
        if (autoPlaySignatureRef.current === signature) {
            return;
        }

        autoPlaySignatureRef.current = signature;
        handleStartStream();
    }, [
        authCooldownEndsAt,
        form.channel,
        form.subtype,
        handleStartStream,
        isLoadingChannels,
        isSubmitting,
        liveRenderMode,
    ]);

    useEffect(() => {
        const handleFullscreenChange = () => {
            setIsFullscreen(!!document.fullscreenElement);
        };

        document.addEventListener('fullscreenchange', handleFullscreenChange);
        return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
    }, []);

    const handleToggleFullscreen = useCallback(async () => {
        try {
            if (!document.fullscreenElement) {
                if (liveContainerRef.current?.requestFullscreen) {
                    await liveContainerRef.current.requestFullscreen();
                }
            } else if (document.exitFullscreen) {
                await document.exitFullscreen();
            }
        } catch {
            // Ignore fullscreen API errors.
        }
    }, []);

    useEffect(() => {
        if (!form.channel && channels.length === 0) {
            setDetectionFeed([]);
            return undefined;
        }

        detectionHistoryRef.current = [];
        detectionThumbRef.current.forEach((url) => {
            try { URL.revokeObjectURL(url); } catch { /* ignore */ }
        });
        detectionThumbRef.current.clear();

        let cancelled = false;
        let timer = null;
        let visibilityDebounce = null;

        const scheduleNext = (delayMs) => {
            if (cancelled) return;
            if (timer) clearTimeout(timer);
            timer = setTimeout(fetchDetections, delayMs);
        };

        const fetchDetections = async () => {
            const now = Date.now();
            if (now - detectionLastFetchAtRef.current < 10000) {
                scheduleNext(10000);
                return;
            }
            if (document.hidden) {
                scheduleNext(15000);
                return;
            }
            if (detectionRequestInFlightRef.current) return;
            if (detectionAuthCooldownEndsAtRef.current > Date.now()) {
                const waitSec = Math.ceil((detectionAuthCooldownEndsAtRef.current - Date.now()) / 1000);
                setDetectionError(`Detection pause ${waitSec} detik (auth kamera 401).`);
                scheduleNext(6000);
                return;
            }
            detectionRequestInFlightRef.current = true;
            detectionLastFetchAtRef.current = now;
            try {
                const channelId = Number(form.channel);
                if (!Number.isFinite(channelId) || channelId <= 0) {
                    setDetectionFeed([]);
                    setDetectionError('');
                    scheduleNext(7000);
                    return;
                }

                const result = await cameraSettingsService.getRealtimeEventStatus({
                    channelId,
                    eventCodes: liveDetectionService.DETECTION_EVENT_CODES,
                    strictChannel: false,
                });
                if (cancelled) return;

                const mapped = liveDetectionService.mapEventEntriesToCards(
                    result?.entries || [],
                    channelId,
                    result?.fetchedAt,
                    result?.raw || '',
                );

                if (mapped.length === 0) {
                    setDetectionFeed(detectionHistoryRef.current.slice(0, 100));
                    setDetectionError('');
                    detectionFailureCountRef.current = 0;
                    scheduleNext(7000);
                    return;
                }

                const knownIds = new Set(detectionHistoryRef.current.map((item) => item.id));
                const hasNewEvents = mapped.some((item) => !knownIds.has(item.id));
                let channelSnapshotBlob = null;
                if (hasNewEvents) {
                    channelSnapshotBlob = await liveDetectionService.fetchChannelSnapshot(channelId);
                }
                const withThumbs = await (async () => {
                    const results = [];
                    for (let i = 0; i < mapped.length; i += 1) {
                        const eventItem = mapped[i];
                        const cacheKey = eventItem.id;
                        if (detectionThumbRef.current.has(cacheKey)) {
                            results.push({ ...eventItem, thumbUrl: detectionThumbRef.current.get(cacheKey) });
                            continue;
                        }
                        if (i >= 5) {
                            results.push(eventItem);
                            continue;
                        }
                        if (!channelSnapshotBlob || !eventItem.boundingBox) {
                            if (eventItem.humanImageBlob) {
                                try {
                                    const blobUrl = URL.createObjectURL(eventItem.humanImageBlob);
                                    detectionThumbRef.current.set(cacheKey, blobUrl);
                                    results.push({ ...eventItem, thumbUrl: blobUrl });
                                } catch {
                                    results.push(eventItem);
                                }
                            } else {
                                results.push(eventItem);
                            }
                            continue;
                        }
                        while (detectionCropSemaphoreRef.current >= MAX_CONCURRENT_CROPS) {
                            await new Promise((res) => setTimeout(res, 10));
                        }
                        detectionCropSemaphoreRef.current += 1;
                        try {
                            const cropped = await liveDetectionService.cropSnapshotByBoundingBox(
                                channelSnapshotBlob,
                                eventItem.boundingBox,
                                {
                                    sceneWidth: eventItem.sceneWidth,
                                    sceneHeight: eventItem.sceneHeight,
                                    boundingScale: eventItem.boundingScale,
                                },
                            );
                            const blob = cropped || channelSnapshotBlob;
                            const blobUrl = URL.createObjectURL(blob);
                            detectionThumbRef.current.set(cacheKey, blobUrl);
                            results.push({ ...eventItem, thumbUrl: blobUrl });
                        } catch {
                            if (eventItem.humanImageBlob) {
                                try {
                                    const blobUrl = URL.createObjectURL(eventItem.humanImageBlob);
                                    detectionThumbRef.current.set(cacheKey, blobUrl);
                                    results.push({ ...eventItem, thumbUrl: blobUrl });
                                } catch {
                                    results.push(eventItem);
                                }
                            } else {
                                results.push(eventItem);
                            }
                        } finally {
                            detectionCropSemaphoreRef.current = Math.max(0, detectionCropSemaphoreRef.current - 1);
                        }
                    }
                    return results;
                })();

                const seen = new Set(detectionHistoryRef.current.map((item) => item.id));
                const appended = withThumbs.filter((item) => !seen.has(item.id));
                detectionHistoryRef.current = [...appended, ...detectionHistoryRef.current].slice(0, 100);
                setDetectionFeed(detectionHistoryRef.current.slice(0, 100));
                setDetectionError('');
                detectionFailureCountRef.current = 0;
                detectionConsecutive401Ref.current = 0;
                scheduleNext(hasNewEvents ? 10000 : 12000);
            } catch (err) {
                if (!cancelled) {
                    const statusCode = Number(err?.response?.status || 0);
                    const message = String(err?.message || '');
                    const isAttachAbort = String(err?.code || '') === 'ERR_CANCELED' || /event-attach-(window-timeout|enough-data)/i.test(message);
                    if (statusCode === 401) {
                        detectionConsecutive401Ref.current += 1;
                        const cooldownMs = detectionConsecutive401Ref.current >= 3 ? 30000 : 10000;
                        detectionAuthCooldownEndsAtRef.current = Date.now() + cooldownMs;
                        setDetectionError(`Auth kamera 401. Detection dijeda ${Math.ceil(cooldownMs / 1000)} detik supaya stabil.`);
                        scheduleNext(6000);
                    } else {
                        setDetectionError(isAttachAbort ? '' : (message || 'Gagal mengambil realtime detection.'));
                        detectionFailureCountRef.current += 1;
                        const backoffMs = Math.min(15000, 5000 + (detectionFailureCountRef.current * 1500));
                        scheduleNext(backoffMs);
                    }
                }
            } finally {
                detectionRequestInFlightRef.current = false;
            }
        };

        fetchDetections();
        const onVisibilityChange = () => {
            if (visibilityDebounce) clearTimeout(visibilityDebounce);
            visibilityDebounce = setTimeout(() => {
                if (!document.hidden) fetchDetections();
            }, 500);
        };
        document.addEventListener('visibilitychange', onVisibilityChange);
        return () => {
            cancelled = true;
            if (timer) clearTimeout(timer);
            if (visibilityDebounce) clearTimeout(visibilityDebounce);
            document.removeEventListener('visibilitychange', onVisibilityChange);
        };
    }, [channels.length, form.channel]);

    return {
        videoRef,
        liveContainerRef,
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
        liveRenderMode,
        setLiveRenderMode,
        authCooldownRemainingSec,
        manifestCodecs,
        go2rtcDiagnostic,
        isFullscreen,
        handleToggleFullscreen,
        handleStartStream,
        detectionFeed,
        detectionError,
    };
}
