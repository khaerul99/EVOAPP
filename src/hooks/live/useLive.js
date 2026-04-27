import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Hls from 'hls.js';
import { cameraService } from '../../services/camera/camera.service';
import { liveService } from '../../services/live/live.service';

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
    };
}
