import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Hls from 'hls.js';
import { Calendar, Loader2, PlayCircle, Radio, Search } from 'lucide-react';
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
    const fallbackPlayerUrl = mode === 'live' ? resolvedLivePlayerUrl : resolvedPlaybackPlayerUrl;
    const activeTransportLabel = useMemo(() => {
        if (resolvedHlsUrl) {
            return 'HLS (video element)';
        }

        if (!fallbackPlayerUrl) {
            return 'Belum aktif';
        }

        try {
            const parsed = new URL(fallbackPlayerUrl, window.location.origin);
            const modeValue = parsed.searchParams.get('mode') || '';
            return modeValue ? `go2rtc player (${modeValue})` : 'go2rtc player';
        } catch {
            return 'go2rtc player';
        }
    }, [fallbackPlayerUrl, resolvedHlsUrl]);

    useEffect(() => {
        const video = videoRef.current;
        if (!video || !resolvedHlsUrl) {
            return undefined;
        }

        setPlayerError('');

        if (video.canPlayType('application/vnd.apple.mpegurl')) {
            video.src = resolvedHlsUrl;
            return undefined;
        }

        if (!Hls.isSupported()) {
            setPlayerError('Browser ini tidak mendukung HLS. Gunakan browser modern atau VLC.');
            return undefined;
        }

        const hls = new Hls({
            lowLatencyMode: mode === 'live',
            backBufferLength: mode === 'live' ? 10 : 120,
            maxBufferLength: mode === 'live' ? 8 : 60,
            maxMaxBufferLength: mode === 'live' ? 16 : 120,
            liveSyncDurationCount: mode === 'live' ? 3 : 6,
            liveMaxLatencyDurationCount: mode === 'live' ? 6 : 12,
            enableWorker: true,
        });
        hls.loadSource(resolvedHlsUrl);
        hls.attachMedia(video);
        hls.on(Hls.Events.ERROR, (_, data) => {
            if (data?.fatal) {
                if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
                    hls.startLoad();
                    setPlayerError('Koneksi stream sempat terganggu, mencoba menyambung ulang...');
                    return;
                }

                if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
                    hls.recoverMediaError();
                    setPlayerError('Player mencoba memulihkan error codec/media...');
                    return;
                }

                setPlayerError('Gagal memuat stream HLS. Pastikan URL HLS gateway benar.');
            }
        });

        return () => {
            hls.destroy();
        };
    }, [mode, resolvedHlsUrl]);

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
            if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || endDate <= startDate) {
                throw new Error('Pastikan rentang waktu playback valid.');
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

    const handleStartStream = useCallback(async () => {
        setError('');
        setPlayerError('');

        setIsSubmitting(true);
        try {
            const sources = buildSources();
            await playbackService.ensureGo2rtcStream({
                streamName: sources.streamName,
                rtspUrl: sources.rtspUrl,
            });

            setStreamSources(sources);
            if (sources.mode === 'playback' && !sources.hlsUrl) {
                setPlayerError('URL HLS belum tersedia. Isi template HLS di env (`VITE_HLS_*_TEMPLATE`).');
            }
        } catch (requestError) {
            const detail = requestError?.message;
            setError(detail ? `Gagal menyiapkan stream: ${detail}` : 'Gagal menyiapkan stream.');
        } finally {
            setIsSubmitting(false);
        }
    }, [buildSources]);

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

    return (
        <div className="space-y-6 duration-500 animate-in fade-in">
            <div className="relative overflow-hidden border bg-gradient-to-br from-white via-slate-50 to-emerald-50 rounded-3xl border-navy/10">
                <div className="absolute rounded-full -top-24 -right-24 w-72 h-72 bg-navy/5 blur-3xl" />
                <div className="absolute rounded-full -bottom-24 -left-24 w-72 h-72 bg-emerald-300/20 blur-3xl" />
                <div className="relative flex flex-col items-start justify-between gap-4 p-6 md:flex-row md:items-center md:p-8">
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.24em] text-navy/40">Video Intelligence</p>
                        <h2 className="mt-2 text-2xl font-black tracking-tight md:text-3xl text-navy">PLAYBACK AND LIVE CENTER</h2>
                    </div>
                    <div className="grid w-full grid-cols-2 gap-2 md:w-auto">
                        <button
                            type="button"
                            onClick={() => setMode('playback')}
                            className={`px-4 py-2 text-[10px] font-black tracking-widest uppercase rounded-xl border transition-all ${mode === 'playback' ? 'bg-navy text-white border-navy' : 'bg-white text-navy/60 border-navy/10'}`}
                        >
                            Playback
                        </button>
                        <button
                            type="button"
                            onClick={() => setMode('live')}
                            className={`px-4 py-2 text-[10px] font-black tracking-widest uppercase rounded-xl border transition-all ${mode === 'live' ? 'bg-navy text-white border-navy' : 'bg-white text-navy/60 border-navy/10'}`}
                        >
                            Live
                        </button>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
                <div className="space-y-6 xl:col-span-3">
                    <div className="relative overflow-hidden border shadow-2xl aspect-video bg-navy rounded-3xl border-white/10">
                        {resolvedHlsUrl ? (
                            <video
                                ref={videoRef}
                                controls
                                muted
                                playsInline
                                className="object-cover w-full h-full"
                            />
                        ) : fallbackPlayerUrl ? (
                            <iframe
                                src={fallbackPlayerUrl}
                                title={mode === 'live' ? 'Live Low Latency Player' : 'Playback Stream Player'}
                                className="w-full h-full border-0"
                                allow="autoplay; fullscreen"
                            />
                        ) : (
                            <div className="absolute inset-0 grid place-items-center bg-slate-900/40">
                                <button type="button" onClick={handleStartStream} disabled={isSubmitting || isLoadingChannels}>
                                    {isSubmitting ? (
                                        <Loader2 size={88} className="text-white opacity-90 animate-spin" />
                                    ) : (
                                        <PlayCircle size={88} className="text-white transition-all opacity-60 hover:scale-110" />
                                    )}
                                </button>
                            </div>
                        )}

                        <div className="absolute flex items-center gap-2 px-4 py-2 border top-6 left-6 bg-white/10 backdrop-blur-xl rounded-xl border-white/10">
                            <Radio size={13} className="text-emerald-300" />
                            <span className="text-[10px] font-black tracking-widest text-white/80 uppercase">
                                {mode === 'live' ? 'Live Mode' : 'Playback Mode'}
                            </span>
                        </div>

                        {streamSources && (
                            <div className="absolute bottom-6 right-6 max-w-[75%] rounded-xl border border-emerald-300/40 bg-emerald-500/20 px-3 py-2 backdrop-blur-md">
                                <p className="text-[10px] font-black uppercase tracking-widest text-emerald-100">
                                    {mode === 'live' ? 'Live Sedang Berjalan' : 'Playback Sedang Berjalan'}
                                </p>
                                <p className="mt-1 text-[10px] text-white/85">
                                    Jika layar masih hitam, tunggu beberapa detik lalu klik tombol play pada player.
                                </p>
                                <p className="mt-1 text-[10px] font-black uppercase tracking-widest text-emerald-100/90">
                                    Transport: {activeTransportLabel}
                                </p>
                            </div>
                        )}
                    </div>

                    <div className="p-6 bg-white border shadow-sm rounded-3xl border-navy/10">
                        <div className="flex items-center justify-between mb-4">
                            <p className="text-[10px] font-black uppercase tracking-widest text-navy/40">Auto Stream Source</p>
                            <Calendar size={14} className="text-navy/20" />
                        </div>
                        <p className="text-[11px] text-navy/60">
                            URL stream dibentuk otomatis dari konfigurasi env dan parameter channel/waktu.
                        </p>
                        <p className="mt-2 text-[11px] text-navy/50">
                            Untuk live monitoring yang ringan, gunakan preset <span className="font-black">Hemat Data</span> (subtype 1).
                        </p>
                    </div>
                </div>

                <div className="space-y-6 xl:col-span-2">
                    <div className="flex flex-col h-full p-6 border shadow-sm bg-white/95 rounded-3xl border-navy/10">
                        <h3 className="mb-6 text-xs font-black tracking-widest uppercase text-navy/40">Stream Controls</h3>

                        <div className="mb-5 space-y-3">
                            <label className="text-[10px] font-black uppercase tracking-widest text-navy/40">Date</label>
                            <input
                                type="date"
                                value={form.selectedDate}
                                onChange={(event) => updateField('selectedDate', event.target.value)}
                                className="w-full px-4 py-3 text-xs font-bold transition-all bg-white border outline-none border-navy/10 rounded-xl focus:border-navy/20"
                            />

                            <label className="text-[10px] font-black uppercase tracking-widest text-navy/40">Channel</label>
                            <select
                                value={form.channel}
                                onChange={(event) => updateField('channel', event.target.value)}
                                className="w-full px-4 py-3 text-xs font-bold transition-all bg-white border outline-none border-navy/10 rounded-xl focus:border-navy/20"
                                disabled={isLoadingChannels}
                            >
                                {channelOptions.map((channelOption) => (
                                    <option key={channelOption.id} value={channelOption.id}>
                                        {channelOption.label}
                                    </option>
                                ))}
                            </select>

                            {(mode === 'live' || mode === 'playback') && (
                                <>
                                    <label className="text-[10px] font-black uppercase tracking-widest text-navy/40">Quality Preset</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        <button
                                            type="button"
                                            onClick={() => updateField('subtype', '1')}
                                            className={`px-3 py-2 text-[10px] font-black tracking-widest uppercase rounded-xl border transition-all ${form.subtype === '1' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-navy/60 border-navy/10'}`}
                                        >
                                            Hemat Data
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => updateField('subtype', '0')}
                                            className={`px-3 py-2 text-[10px] font-black tracking-widest uppercase rounded-xl border transition-all ${form.subtype === '0' ? 'bg-navy text-white border-navy' : 'bg-white text-navy/60 border-navy/10'}`}
                                        >
                                            HQ
                                        </button>
                                    </div>

                                    <label className="text-[10px] font-black uppercase tracking-widest text-navy/40">Stream Type</label>
                                    <select
                                        value={form.subtype}
                                        onChange={(event) => updateField('subtype', event.target.value)}
                                        className="w-full px-4 py-3 text-xs font-bold transition-all bg-white border outline-none border-navy/10 rounded-xl focus:border-navy/20"
                                    >
                                        <option value="0">Main Stream (subtype 0)</option>
                                        <option value="1">Sub Stream (subtype 1)</option>
                                    </select>
                                </>
                            )}

                            {mode === 'playback' && (
                                <>
                                    <label className="text-[10px] font-black uppercase tracking-widest text-navy/40">Start Time</label>
                                    <input
                                        type="datetime-local"
                                        value={form.starttime}
                                        onChange={(event) => updateField('starttime', event.target.value)}
                                        className="w-full px-4 py-3 text-xs font-bold transition-all bg-white border outline-none border-navy/10 rounded-xl focus:border-navy/20"
                                    />

                                    <label className="text-[10px] font-black uppercase tracking-widest text-navy/40">End Time</label>
                                    <input
                                        type="datetime-local"
                                        value={form.endtime}
                                        onChange={(event) => updateField('endtime', event.target.value)}
                                        className="w-full px-4 py-3 text-xs font-bold transition-all bg-white border outline-none border-navy/10 rounded-xl focus:border-navy/20"
                                    />
                                </>
                            )}
                        </div>

                        <button
                            type="button"
                            onClick={handleStartStream}
                            disabled={isSubmitting || isLoadingChannels}
                            className="inline-flex items-center justify-center w-full gap-2 py-4 text-[10px] font-black tracking-widest uppercase transition-all border bg-navy text-white border-navy rounded-xl hover:bg-navy/90 disabled:opacity-60"
                        >
                            {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                            Start Stream
                        </button>

                        <div className="flex-1 mt-5 space-y-3 overflow-y-auto">
                            {streamSources?.hlsUrl && (
                                <div className="p-3 border rounded-xl border-navy/10 bg-background">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-navy/40">HLS URL</p>
                                    <p className="mt-1 text-[11px] font-mono break-all text-navy/70">{streamSources.hlsUrl}</p>
                                </div>
                            )}

                            {streamSources?.livePlayerUrl && mode === 'live' && (
                                <div className="p-3 border rounded-xl border-sky-200 bg-sky-50/60">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-sky-700">Live Player URL</p>
                                    <p className="mt-1 text-[11px] font-mono break-all text-sky-900">{streamSources.livePlayerUrl}</p>
                                </div>
                            )}

                            {streamSources?.playbackPlayerUrl && mode === 'playback' && (
                                <div className="p-3 border rounded-xl border-indigo-200 bg-indigo-50/60">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-indigo-700">Playback Player URL</p>
                                    <p className="mt-1 text-[11px] font-mono break-all text-indigo-900">{streamSources.playbackPlayerUrl}</p>
                                </div>
                            )}

                            {streamSources?.rtspUrl && (
                                <div className="p-3 border rounded-xl border-emerald-200 bg-emerald-50/60">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-emerald-700">RTSP URL</p>
                                    <p className="mt-1 text-[11px] font-mono break-all text-emerald-900">{streamSources.rtspUrl}</p>
                                </div>
                            )}

                            {streamSources && (
                                <div className="p-3 border rounded-xl border-slate-200 bg-slate-50/80">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-600">Active Transport</p>
                                    <p className="mt-1 text-[11px] font-bold text-slate-800">{activeTransportLabel}</p>
                                </div>
                            )}

                            {playerError && (
                                <div className="p-3 border rounded-xl bg-amber-50 border-amber-200">
                                    <p className="text-[11px] font-bold text-amber-700">{playerError}</p>
                                </div>
                            )}

                            {error && (
                                <div className="p-3 border rounded-xl bg-danger/10 border-danger/20">
                                    <p className="text-[11px] font-bold text-danger">{error}</p>
                                </div>
                            )}

                            {!streamSources && !error && (
                                <div className="p-3 border rounded-xl bg-background border-navy/10">
                                    <p className="text-[11px] font-bold text-navy/60">
                                        Pilih mode Live/Playback lalu klik Start Stream.
                                    </p>
                                    <p className="mt-1 text-[10px] text-navy/50">
                                        Setelah stream tampil, klik tombol play di player untuk mulai memutar video.
                                    </p>
                                </div>
                            )}
                        </div>

                        <p className="mt-5 text-[10px] text-navy/45">
                            Channel aktif: <span className="font-black text-navy/70">{selectedChannel?.channelName || selectedChannel?.name || `Channel ${form.channel}`}</span>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Playback;
