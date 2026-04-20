import React from 'react';
import { Loader2, PlayCircle, Radio, Search, Signal } from 'lucide-react';
import { useLive } from '../../../hooks/live/useLive';

const LiveMonitoring = () => {
    const {
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
        liveRenderMode,
        setLiveRenderMode,
        authCooldownRemainingSec,
        manifestCodecs,
        go2rtcDiagnostic,
        handleStartStream,
    } = useLive();

    return (
        <div className="space-y-6 duration-500 animate-in fade-in">
            <div className="relative overflow-hidden border rounded-3xl border-navy/10 bg-gradient-to-br from-slate-50 via-white to-cyan-50">
                <div className="absolute w-64 h-64 rounded-full -top-20 -right-20 bg-cyan-300/20 blur-3xl" />
                <div className="absolute w-64 h-64 rounded-full -bottom-20 -left-20 bg-blue-300/20 blur-3xl" />
                <div className="relative flex flex-col gap-4 p-6 md:flex-row md:items-center md:justify-between md:p-8">
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.24em] text-navy/45">Stream Console</p>
                        <h2 className="mt-2 text-2xl font-black tracking-tight text-navy md:text-3xl">Live Monitoring</h2>
                    </div>
                    <div className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-emerald-700">
                        <Radio size={14} />
                        Live Only
                    </div>
                </div>
            </div>

            {(error || playerError) && (
                <div className="p-4 bg-white border shadow-sm rounded-2xl border-navy/10 text-navy/70">
                    <p className="text-xs font-semibold tracking-[0.2em] uppercase">
                        {error || playerError}
                    </p>
                </div>
            )}

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
                                title="Live Stream Player"
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
                            <Radio size={13} className="text-cyan-300" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-white/85">Live Mode</span>
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
                </section>

                <aside className="space-y-6 xl:col-span-2">
                    <div className="h-full p-6 bg-white border shadow-sm rounded-3xl border-navy/10">
                        <h3 className="mb-5 text-xs font-black tracking-widest uppercase text-navy/45">Live Controls</h3>

                        <div className="space-y-3">
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
                        </div>

                        <button
                            type="button"
                            onClick={handleStartStream}
                            disabled={isSubmitting || isLoadingChannels || authCooldownRemainingSec > 0}
                            className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-navy bg-navy py-4 text-[10px] font-black uppercase tracking-widest text-white transition-all hover:bg-navy/90 disabled:opacity-60"
                        >
                            {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                            {authCooldownRemainingSec > 0 ? `Tunggu ${authCooldownRemainingSec} dtk` : 'Start Live Stream'}
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

                            {activeSourceInfo?.rtspUrl && (
                                <div className="p-3 border rounded-xl border-emerald-200 bg-emerald-50/80">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-emerald-700">RTSP URL (VLC)</p>
                                    <p className="mt-1 break-all font-mono text-[11px] text-emerald-900">{activeSourceInfo.rtspUrl}</p>
                                </div>
                            )}

                            {activeSourceInfo?.livePlayerUrl && (
                                <div className="p-3 border rounded-xl border-sky-200 bg-sky-50/80">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-sky-700">Live Player URL</p>
                                    <p className="mt-1 break-all font-mono text-[11px] text-sky-900">{activeSourceInfo.livePlayerUrl}</p>
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
                        </div>
                    </div>
                </aside>
            </div>
        </div>
    );
};

export default LiveMonitoring;