import React from 'react';
import { Calendar, Clock3, Loader2, PlayCircle, Radio, Search, Signal } from 'lucide-react';
import { formatRecordingDuration, formatRecordingLabel, usePlayback } from '../../../hooks/playback/usePlayback';

const Playback = () => {
    const {
        videoRef,
        mode,
        setMode,
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
    } = usePlayback();

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
                        <div className="p-4 bg-white border rounded-2xl border-navy/10">
                            <p className="text-[10px] font-black uppercase tracking-widest text-navy/45">Channel Aktif</p>
                            <p className="mt-2 text-sm font-bold text-navy">{selectedChannel?.channelName || selectedChannel?.name || `Channel ${form.channel}`}</p>
                        </div>
                        <div className="p-4 bg-white border rounded-2xl border-navy/10">
                            <p className="text-[10px] font-black uppercase tracking-widest text-navy/45">Preset</p>
                            <p className="mt-2 text-sm font-bold text-navy">{form.subtype === '1' ? 'Hemat Data (Substream)' : 'Kualitas Tinggi (Mainstream)'}</p>
                        </div>
                        <div className="p-4 bg-white border rounded-2xl border-navy/10">
                            <p className="text-[10px] font-black uppercase tracking-widest text-navy/45">Mode Render</p>
                            <p className="mt-2 text-sm font-bold text-navy">{activeTransportLabel}</p>
                        </div>
                    </div>

                    {mode === 'playback' && (
                        <div className="p-4 bg-white border rounded-2xl border-navy/10 md:p-5">
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
                                <div className="p-3 mt-3 border rounded-xl border-amber-200 bg-amber-50">
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
                                <div className="grid grid-cols-1 gap-3 mt-3 md:grid-cols-2">
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
                    <div className="h-full p-6 bg-white border shadow-sm rounded-3xl border-navy/10">
                        <h3 className="mb-5 text-xs font-black tracking-widest uppercase text-navy/45">Stream Controls</h3>

                        <div className="space-y-3">
                            <label className="text-[10px] font-black uppercase tracking-widest text-navy/45">Date</label>
                            <input
                                type="date"
                                value={form.selectedDate}
                                onChange={(event) => updateField('selectedDate', event.target.value)}
                                className="w-full px-4 py-3 text-xs font-bold transition-all bg-white border outline-none rounded-xl border-navy/15 focus:border-navy/25"
                            />

                            <label className="text-[10px] font-black uppercase tracking-widest text-navy/45">Channel</label>
                            <select
                                value={form.channel}
                                onChange={(event) => updateField('channel', event.target.value)}
                                className="w-full px-4 py-3 text-xs font-bold transition-all bg-white border outline-none rounded-xl border-navy/15 focus:border-navy/25"
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
                                        className="w-full px-4 py-3 text-xs font-bold transition-all bg-white border outline-none rounded-xl border-navy/15 focus:border-navy/25"
                                    />

                                    <label className="text-[10px] font-black uppercase tracking-widest text-navy/45">End Time</label>
                                    <input
                                        type="datetime-local"
                                        value={form.endtime}
                                        onChange={(event) => updateField('endtime', event.target.value)}
                                        className="w-full px-4 py-3 text-xs font-bold transition-all bg-white border outline-none rounded-xl border-navy/15 focus:border-navy/25"
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
                            <div className="p-3 border rounded-xl border-slate-200 bg-slate-50/90">
                                <div className="flex items-center gap-2">
                                    <Signal size={14} className="text-slate-500" />
                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-600">Transport</p>
                                </div>
                                <p className="mt-1 text-[11px] font-bold text-slate-800">{activeTransportLabel}</p>
                                {manifestCodecs && (
                                    <p className="mt-1 font-mono text-[10px] text-slate-600">codec: {manifestCodecs}</p>
                                )}
                            </div>

                            {/* {mode === 'playback' && (
                                <div className="p-3 border rounded-xl border-sky-200 bg-sky-50/80">
                                    <div className="flex items-center gap-2">
                                        <Clock3 size={14} className="text-sky-700" />
                                        <p className="text-[10px] font-black uppercase tracking-widest text-sky-700">Playback Window</p>
                                    </div>
                                    <p className="mt-1 text-[11px] text-sky-900">{form.starttime} sampai {form.endtime}</p>
                                </div>
                            )} */}

                            {/* {activeSourceInfo?.hlsUrl && (
                                <div className="p-3 border rounded-xl border-navy/10 bg-background">
                                    <div className="flex items-center gap-2">
                                        <Calendar size={14} className="text-navy/45" />
                                        <p className="text-[10px] font-black uppercase tracking-widest text-navy/45">HLS URL</p>
                                    </div>
                                    <p className="mt-1 break-all font-mono text-[11px] text-navy/70">{activeSourceInfo.hlsUrl}</p>
                                </div>
                            )} */}

                            {activeSourceInfo?.rtspUrl && (
                                <div className="p-3 border rounded-xl border-emerald-200 bg-emerald-50/80">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-emerald-700">RTSP URL (VLC)</p>
                                    <p className="mt-1 break-all font-mono text-[11px] text-emerald-900">{activeSourceInfo.rtspUrl}</p>
                                </div>
                            )}

                            {activeSourceInfo?.livePlayerUrl && mode === 'live' && (
                                <div className="p-3 border rounded-xl border-sky-200 bg-sky-50/80">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-sky-700">Live Player URL</p>
                                    <p className="mt-1 break-all font-mono text-[11px] text-sky-900">{activeSourceInfo.livePlayerUrl}</p>
                                </div>
                            )}

                            {activeSourceInfo?.playbackPlayerUrl && mode === 'playback' && (
                                <div className="p-3 border border-indigo-200 rounded-xl bg-indigo-50/80">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-indigo-700">Playback Player URL</p>
                                    <p className="mt-1 break-all font-mono text-[11px] text-indigo-900">{activeSourceInfo.playbackPlayerUrl}</p>
                                </div>
                            )}

                            {go2rtcDiagnostic && (
                                <div className="p-3 border rounded-xl border-rose-200 bg-rose-50">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-rose-700">go2rtc Diagnostic</p>
                                    <p className="mt-1 break-all font-mono text-[11px] text-rose-900">{go2rtcDiagnostic}</p>
                                </div>
                            )}

                            {playerError && (
                                <div className="p-3 border rounded-xl border-amber-200 bg-amber-50">
                                    <p className="text-[11px] font-bold text-amber-700">{playerError}</p>
                                </div>
                            )}

                            {error && (
                                <div className="p-3 border rounded-xl border-danger/20 bg-danger/10">
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
