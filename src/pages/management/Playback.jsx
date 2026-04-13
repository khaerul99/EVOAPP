import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Hls from 'hls.js';
import { Calendar, Clock3, Loader2, PlayCircle, Radio, Search, Signal } from 'lucide-react';
import { cameraService } from '../../services/camera.service';
import { playbackService } from '../../services/playback.service';

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

function formatRecordingLabel(value) {
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

function formatRecordingDuration(beginTime, endTime) {
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

const Playback = () => {
    const now = new Date();
    const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000);

    const videoRef = useRef(null);

    const [mode, setMode] = useState('playback');
    const [channels, setChannels] = useState([]);
    const [isLoadingChannels, setIsLoadingChannels] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [playerError, setPlayerError] = useState('');
    const [streamSources, setStreamSources] = useState(null);
    const [lastAttemptSources, setLastAttemptSources] = useState(null);
    const [isHlsReady, setIsHlsReady] = useState(false);
    const [liveRenderMode, setLiveRenderMode] = useState('auto');
    const [playbackRenderMode, setPlaybackRenderMode] = useState('player');
    const [go2rtcDiagnostic, setGo2rtcDiagnostic] = useState('');
    const [manifestCodecs, setManifestCodecs] = useState('');
    const [recordings, setRecordings] = useState([]);
    const [isLoadingRecordings, setIsLoadingRecordings] = useState(false);
    const [recordingError, setRecordingError] = useState('');
    const [selectedRecordingKey, setSelectedRecordingKey] = useState('');

    const [form, setForm] = useState({
        selectedDate: toLocalDateInputValue(now),
        channel: '1',
        subtype: '0',
        starttime: toLocalDateTimeInputValue(tenMinutesAgo),
        endtime: toLocalDateTimeInputValue(now),
    });

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
    const resolvedLivePlayerUrl = mode === 'live' ? (streamSources?.livePlayerUrl || '') : '';
    const resolvedPlaybackPlayerUrl = mode === 'playback' ? (streamSources?.playbackPlayerUrl || '') : '';
    const iframeUrl = mode === 'live' ? resolvedLivePlayerUrl : resolvedPlaybackPlayerUrl;
    const isHevcStream = /(^|,)\s*(hvc1|hev1)\b/i.test(String(manifestCodecs || ''));

    const forceLiveHls = mode === 'live' && liveRenderMode === 'hls';
    const forcePlaybackHls = mode === 'playback' && playbackRenderMode === 'hls';
    const preferPlaybackIframe = mode === 'playback' && playbackRenderMode !== 'hls';
    const shouldUseIframe = mode === 'live'
        ? Boolean(iframeUrl) && !forceLiveHls
        : Boolean(iframeUrl) && (!resolvedHlsUrl || isHevcStream || preferPlaybackIframe) && !forcePlaybackHls;
    const shouldUseHls = mode === 'live'
        ? Boolean(resolvedHlsUrl) && (forceLiveHls || !shouldUseIframe)
        : Boolean(resolvedHlsUrl) && !shouldUseIframe;

    const activePlayerType = shouldUseHls ? 'hls' : (shouldUseIframe ? 'iframe' : 'none');
    const activeTransportLabel = useMemo(
        () => getTransportLabel(mode, activePlayerType, Boolean(resolvedHlsUrl), Boolean(iframeUrl)),
        [activePlayerType, iframeUrl, mode, resolvedHlsUrl],
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
            lowLatencyMode: mode === 'live',
            backBufferLength: mode === 'live' ? 8 : 45,
            maxBufferLength: mode === 'live' ? 5 : 18,
            maxMaxBufferLength: mode === 'live' ? 10 : 36,
            liveSyncDurationCount: mode === 'live' ? 2 : 4,
            liveMaxLatencyDurationCount: mode === 'live' ? 5 : 8,
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
    }, [isHlsReady, mode, resolvedHlsUrl, shouldUseHls]);

    useEffect(() => {
        if (mode !== 'playback' || playbackRenderMode !== 'hls') {
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
    }, [mode, playbackRenderMode, streamSources]);

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

        if (mode === 'playback') {
            const startDate = new Date(form.starttime);
            const endDate = new Date(form.endtime);
            const nowDate = new Date();
            if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || endDate <= startDate) {
                throw new Error('Pastikan rentang waktu playback valid.');
            }
            if (startDate > nowDate || endDate > nowDate) {
                throw new Error('Waktu playback tidak boleh melebihi waktu saat ini.');
            }
        }

        return mode === 'live'
            ? playbackService.buildLiveStreamSources({
                channel: form.channel,
                subtype: form.subtype,
            })
            : playbackService.buildPlaybackStreamSources({
                channel: form.channel,
                subtype: form.subtype,
                starttime: form.starttime,
                endtime: form.endtime,
            });
    }, [channels, form.channel, form.endtime, form.starttime, form.subtype, mode]);

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

                await playbackService.ensureGo2rtcStream({
                    streamName: candidateSources.streamName,
                    rtspUrl: candidateRtspUrl,
                });

                const shouldProbeHls = Boolean(candidateSources.hlsUrl) && (
                    (candidateSources.mode === 'playback' && (playbackRenderMode === 'hls' || !candidateSources.playbackPlayerUrl))
                    || (candidateSources.mode === 'live' && (liveRenderMode === 'hls' || !candidateSources.livePlayerUrl))
                );
                let candidateHlsReady = Boolean(candidateSources.hlsUrl) && !shouldProbeHls;
                let candidateManifestRaw = '';
                if (shouldProbeHls) {
                    candidateHlsReady = await playbackService.waitForHlsReady({
                        hlsUrl: candidateSources.hlsUrl,
                        timeoutMs: candidateSources.mode === 'playback' ? 9000 : 5000,
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
    }, [buildSources, liveRenderMode, playbackRenderMode, readGo2rtcDiagnostic]);

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

    useEffect(() => {
        if (mode === 'playback') {
            return;
        }

        setRecordings([]);
        setRecordingError('');
        setSelectedRecordingKey('');
    }, [mode]);

    return (
        <div className="space-y-6 duration-500 animate-in fade-in">
            <div className="relative overflow-hidden border rounded-3xl border-navy/10 bg-gradient-to-br from-slate-50 via-white to-cyan-50">
                <div className="absolute w-64 h-64 rounded-full -top-20 -right-20 bg-cyan-300/20 blur-3xl" />
                <div className="absolute w-64 h-64 rounded-full -bottom-20 -left-20 bg-blue-300/20 blur-3xl" />
                <div className="relative flex flex-col gap-4 p-6 md:flex-row md:items-center md:justify-between md:p-8">
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.24em] text-navy/45">Stream Console</p>
                        <h2 className="mt-2 text-2xl font-black tracking-tight text-navy md:text-3xl">Playback And Live Monitoring</h2>
                    </div>
                    <div className="grid w-full grid-cols-2 gap-2 md:w-auto">
                        <button
                            type="button"
                            onClick={() => setMode('playback')}
                            className={`rounded-xl border px-4 py-2 text-[10px] font-black uppercase tracking-widest transition-all ${mode === 'playback' ? 'border-navy bg-navy text-white' : 'border-navy/15 bg-white text-navy/60'}`}
                        >
                            Playback
                        </button>
                        <button
                            type="button"
                            onClick={() => setMode('live')}
                            className={`rounded-xl border px-4 py-2 text-[10px] font-black uppercase tracking-widest transition-all ${mode === 'live' ? 'border-sky-600 bg-sky-600 text-white' : 'border-navy/15 bg-white text-navy/60'}`}
                        >
                            Live
                        </button>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
                <section className="space-y-6 xl:col-span-3">
                    <div className="relative overflow-hidden border shadow-2xl aspect-video rounded-3xl border-white/10 bg-navy">
                        {shouldUseHls ? (
                            <video
                                ref={videoRef}
                                controls
                                muted
                                autoPlay
                                playsInline
                                preload="metadata"
                                className="object-cover w-full h-full"
                            />
                        ) : shouldUseIframe ? (
                            <iframe
                                src={iframeUrl}
                                title={mode === 'live' ? 'Live Stream Player' : 'Playback Stream Player'}
                                className="w-full h-full border-0"
                                allow="autoplay; fullscreen; encrypted-media"
                            />
                        ) : (
                            <div className="absolute inset-0 grid place-items-center bg-slate-900/40">
                                <button type="button" onClick={handleStartStream} disabled={isSubmitting || isLoadingChannels}>
                                    {isSubmitting ? (
                                        <Loader2 size={88} className="text-white opacity-90 animate-spin" />
                                    ) : (
                                        <PlayCircle size={88} className="text-white transition-all opacity-70 hover:scale-110" />
                                    )}
                                </button>
                            </div>
                        )}

                        <div className="absolute flex items-center gap-2 px-4 py-2 border top-5 left-5 rounded-xl border-white/20 bg-white/10 backdrop-blur-xl">
                            <Radio size={13} className={mode === 'live' ? 'text-cyan-300' : 'text-emerald-300'} />
                            <span className="text-[10px] font-black uppercase tracking-widest text-white/85">
                                {mode === 'live' ? 'Live Mode' : 'Playback Mode'}
                            </span>
                        </div>

                        {streamSources && (
                            <div className="absolute bottom-5 right-5 max-w-[78%] rounded-xl border border-cyan-200/30 bg-cyan-500/20 px-3 py-2 backdrop-blur-md">
                                <p className="text-[10px] font-black uppercase tracking-widest text-cyan-100">Transport: {activeTransportLabel}</p>
                                <p className="mt-1 text-[10px] text-white/85">
                                    Jika layar masih hitam, tunggu 2-3 detik lalu klik Start Stream lagi.
                                </p>
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                        <div className="rounded-2xl border border-navy/10 bg-white p-4">
                            <p className="text-[10px] font-black uppercase tracking-widest text-navy/45">Channel Aktif</p>
                            <p className="mt-2 text-sm font-bold text-navy">{selectedChannel?.channelName || selectedChannel?.name || `Channel ${form.channel}`}</p>
                        </div>
                        <div className="rounded-2xl border border-navy/10 bg-white p-4">
                            <p className="text-[10px] font-black uppercase tracking-widest text-navy/45">Preset</p>
                            <p className="mt-2 text-sm font-bold text-navy">{form.subtype === '1' ? 'Hemat Data (Substream)' : 'Kualitas Tinggi (Mainstream)'}</p>
                        </div>
                        <div className="rounded-2xl border border-navy/10 bg-white p-4">
                            <p className="text-[10px] font-black uppercase tracking-widest text-navy/45">Mode Render</p>
                            <p className="mt-2 text-sm font-bold text-navy">{activeTransportLabel}</p>
                        </div>
                    </div>

                    {mode === 'playback' && (
                        <div className="rounded-2xl border border-navy/10 bg-white p-4 md:p-5">
                            <div className="flex items-center justify-between gap-3">
                                <p className="text-[10px] font-black uppercase tracking-widest text-navy/45">Daftar Rekaman</p>
                                <button
                                    type="button"
                                    onClick={handleFindRecordings}
                                    disabled={isLoadingRecordings || isSubmitting}
                                    className="rounded-lg border border-navy/15 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-navy/70 transition-all hover:bg-navy/5 disabled:opacity-60"
                                >
                                    Refresh
                                </button>
                            </div>

                            {recordingError && (
                                <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
                                    <p className="text-[11px] font-bold text-amber-700">{recordingError}</p>
                                </div>
                            )}

                            {isLoadingRecordings && (
                                <div className="mt-3 flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-[11px] font-bold text-slate-700">
                                    <Loader2 size={14} className="animate-spin" />
                                    Memuat daftar rekaman...
                                </div>
                            )}

                            {!isLoadingRecordings && recordings.length > 0 && (
                                <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                                    {recordings.map((record, index) => {
                                        const key = `${record?.beginTime || ''}|${record?.endTime || ''}|${record?.filePath || ''}|${index}`;
                                        const active = selectedRecordingKey === key;
                                        return (
                                            <button
                                                key={key}
                                                type="button"
                                                onClick={() => {
                                                    setSelectedRecordingKey(key);
                                                    applyRecordingWindow(record);
                                                }}
                                                className={`rounded-xl border p-3 text-left transition-all ${active ? 'border-sky-500 bg-sky-50' : 'border-navy/10 bg-background hover:border-navy/30'}`}
                                            >
                                                <p className="text-[10px] font-black uppercase tracking-widest text-navy/45">Rekaman #{index + 1}</p>
                                                <p className="mt-1 text-[12px] font-bold text-navy">{formatRecordingLabel(record.beginTime)}</p>
                                                <p className="text-[12px] font-bold text-navy">sampai {formatRecordingLabel(record.endTime)}</p>
                                                <p className="mt-1 text-[10px] font-mono text-navy/60">Durasi: {formatRecordingDuration(record.beginTime, record.endTime)}</p>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}
                </section>

                <aside className="space-y-6 xl:col-span-2">
                    <div className="h-full rounded-3xl border border-navy/10 bg-white p-6 shadow-sm">
                        <h3 className="mb-5 text-xs font-black uppercase tracking-widest text-navy/45">Stream Controls</h3>

                        <div className="space-y-3">
                            <label className="text-[10px] font-black uppercase tracking-widest text-navy/45">Date</label>
                            <input
                                type="date"
                                value={form.selectedDate}
                                onChange={(event) => updateField('selectedDate', event.target.value)}
                                className="w-full rounded-xl border border-navy/15 bg-white px-4 py-3 text-xs font-bold outline-none transition-all focus:border-navy/25"
                            />

                            <label className="text-[10px] font-black uppercase tracking-widest text-navy/45">Channel</label>
                            <select
                                value={form.channel}
                                onChange={(event) => updateField('channel', event.target.value)}
                                className="w-full rounded-xl border border-navy/15 bg-white px-4 py-3 text-xs font-bold outline-none transition-all focus:border-navy/25"
                                disabled={isLoadingChannels}
                            >
                                {channelOptions.map((channelOption) => (
                                    <option key={channelOption.id} value={channelOption.id}>
                                        {channelOption.label}
                                    </option>
                                ))}
                            </select>

                            <label className="text-[10px] font-black uppercase tracking-widest text-navy/45">Quality Preset</label>
                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    type="button"
                                    onClick={() => updateField('subtype', '1')}
                                    className={`rounded-xl border px-3 py-2 text-[10px] font-black uppercase tracking-widest transition-all ${form.subtype === '1' ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-navy/15 bg-white text-navy/60'}`}
                                >
                                    Hemat Data
                                </button>
                                <button
                                    type="button"
                                    onClick={() => updateField('subtype', '0')}
                                    className={`rounded-xl border px-3 py-2 text-[10px] font-black uppercase tracking-widest transition-all ${form.subtype === '0' ? 'border-navy bg-navy text-white' : 'border-navy/15 bg-white text-navy/60'}`}
                                >
                                    HQ
                                </button>
                            </div>

                            {mode === 'live' && (
                                <>
                                    <label className="text-[10px] font-black uppercase tracking-widest text-navy/45">Live Render</label>
                                    <div className="grid grid-cols-3 gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setLiveRenderMode('auto')}
                                            className={`rounded-xl border px-2 py-2 text-[10px] font-black uppercase tracking-widest transition-all ${liveRenderMode === 'auto' ? 'border-navy bg-navy text-white' : 'border-navy/15 bg-white text-navy/60'}`}
                                        >
                                            Auto
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setLiveRenderMode('webrtc')}
                                            className={`rounded-xl border px-2 py-2 text-[10px] font-black uppercase tracking-widest transition-all ${liveRenderMode === 'webrtc' ? 'border-sky-600 bg-sky-600 text-white' : 'border-navy/15 bg-white text-navy/60'}`}
                                        >
                                            WebRTC
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setLiveRenderMode('hls')}
                                            className={`rounded-xl border px-2 py-2 text-[10px] font-black uppercase tracking-widest transition-all ${liveRenderMode === 'hls' ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-navy/15 bg-white text-navy/60'}`}
                                        >
                                            HLS
                                        </button>
                                    </div>
                                </>
                            )}

                            {mode === 'playback' && (
                                <>
                                    <label className="text-[10px] font-black uppercase tracking-widest text-navy/45">Playback Render</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setPlaybackRenderMode('player')}
                                            className={`rounded-xl border px-2 py-2 text-[10px] font-black uppercase tracking-widest transition-all ${playbackRenderMode === 'player' ? 'border-sky-600 bg-sky-600 text-white' : 'border-navy/15 bg-white text-navy/60'}`}
                                        >
                                            Player
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setPlaybackRenderMode('hls')}
                                            className={`rounded-xl border px-2 py-2 text-[10px] font-black uppercase tracking-widest transition-all ${playbackRenderMode === 'hls' ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-navy/15 bg-white text-navy/60'}`}
                                        >
                                            HLS
                                        </button>
                                    </div>

                                    <label className="text-[10px] font-black uppercase tracking-widest text-navy/45">Start Time</label>
                                    <input
                                        type="datetime-local"
                                        value={form.starttime}
                                        onChange={(event) => updateField('starttime', event.target.value)}
                                        className="w-full rounded-xl border border-navy/15 bg-white px-4 py-3 text-xs font-bold outline-none transition-all focus:border-navy/25"
                                    />

                                    <label className="text-[10px] font-black uppercase tracking-widest text-navy/45">End Time</label>
                                    <input
                                        type="datetime-local"
                                        value={form.endtime}
                                        onChange={(event) => updateField('endtime', event.target.value)}
                                        className="w-full rounded-xl border border-navy/15 bg-white px-4 py-3 text-xs font-bold outline-none transition-all focus:border-navy/25"
                                    />

                                    <button
                                        type="button"
                                        onClick={handleFindRecordings}
                                        disabled={isLoadingRecordings || isSubmitting}
                                        className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-sky-600 bg-sky-50 py-3 text-[10px] font-black uppercase tracking-widest text-sky-700 transition-all hover:bg-sky-100 disabled:opacity-60"
                                    >
                                        {isLoadingRecordings ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                                        Cari Rekaman
                                    </button>
                                </>
                            )}
                        </div>

                        <button
                            type="button"
                            onClick={handleStartStream}
                            disabled={isSubmitting || isLoadingChannels}
                            className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-navy bg-navy py-4 text-[10px] font-black uppercase tracking-widest text-white transition-all hover:bg-navy/90 disabled:opacity-60"
                        >
                            {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                            {mode === 'live' ? 'Start Live Stream' : 'Start Playback'}
                        </button>

                        <div className="mt-5 space-y-3">
                            <div className="rounded-xl border border-slate-200 bg-slate-50/90 p-3">
                                <div className="flex items-center gap-2">
                                    <Signal size={14} className="text-slate-500" />
                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-600">Transport</p>
                                </div>
                                <p className="mt-1 text-[11px] font-bold text-slate-800">{activeTransportLabel}</p>
                                {manifestCodecs && (
                                    <p className="mt-1 font-mono text-[10px] text-slate-600">codec: {manifestCodecs}</p>
                                )}
                            </div>

                            {mode === 'playback' && (
                                <div className="rounded-xl border border-sky-200 bg-sky-50/80 p-3">
                                    <div className="flex items-center gap-2">
                                        <Clock3 size={14} className="text-sky-700" />
                                        <p className="text-[10px] font-black uppercase tracking-widest text-sky-700">Playback Window</p>
                                    </div>
                                    <p className="mt-1 text-[11px] text-sky-900">{form.starttime} sampai {form.endtime}</p>
                                </div>
                            )}

                            {activeSourceInfo?.hlsUrl && (
                                <div className="rounded-xl border border-navy/10 bg-background p-3">
                                    <div className="flex items-center gap-2">
                                        <Calendar size={14} className="text-navy/45" />
                                        <p className="text-[10px] font-black uppercase tracking-widest text-navy/45">HLS URL</p>
                                    </div>
                                    <p className="mt-1 break-all font-mono text-[11px] text-navy/70">{activeSourceInfo.hlsUrl}</p>
                                </div>
                            )}

                            {activeSourceInfo?.rtspUrl && (
                                <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-3">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-emerald-700">RTSP URL (VLC)</p>
                                    <p className="mt-1 break-all font-mono text-[11px] text-emerald-900">{activeSourceInfo.rtspUrl}</p>
                                </div>
                            )}

                            {activeSourceInfo?.livePlayerUrl && mode === 'live' && (
                                <div className="rounded-xl border border-sky-200 bg-sky-50/80 p-3">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-sky-700">Live Player URL</p>
                                    <p className="mt-1 break-all font-mono text-[11px] text-sky-900">{activeSourceInfo.livePlayerUrl}</p>
                                </div>
                            )}

                            {activeSourceInfo?.playbackPlayerUrl && mode === 'playback' && (
                                <div className="rounded-xl border border-indigo-200 bg-indigo-50/80 p-3">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-indigo-700">Playback Player URL</p>
                                    <p className="mt-1 break-all font-mono text-[11px] text-indigo-900">{activeSourceInfo.playbackPlayerUrl}</p>
                                </div>
                            )}

                            {go2rtcDiagnostic && (
                                <div className="rounded-xl border border-rose-200 bg-rose-50 p-3">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-rose-700">go2rtc Diagnostic</p>
                                    <p className="mt-1 break-all font-mono text-[11px] text-rose-900">{go2rtcDiagnostic}</p>
                                </div>
                            )}

                            {playerError && (
                                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                                    <p className="text-[11px] font-bold text-amber-700">{playerError}</p>
                                </div>
                            )}

                            {error && (
                                <div className="rounded-xl border border-danger/20 bg-danger/10 p-3">
                                    <p className="text-[11px] font-bold text-danger">{error}</p>
                                </div>
                            )}
                        </div>
                    </div>
                </aside>
            </div>
        </div>
    );
};

export default Playback;
