import React from 'react';
import { Loader2, Maximize2, Minimize2, Radio, Signal, Sparkles, Shirt, UserRound, Briefcase, Car } from 'lucide-react';
import { useLive } from '../../../hooks/live/useLive';

const LiveMonitoring = () => {
    const {
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
        detectionFeed,
        detectionError,
    } = useLive();

    const colorClassByName = {
        black: 'bg-black',
        gray: 'bg-gray-400',
        white: 'bg-white border border-slate-300',
        blue: 'bg-blue-500',
        red: 'bg-red-500',
        green: 'bg-green-500',
        yellow: 'bg-yellow-400',
    };
    const getColorBadgeClass = (colorName) => colorClassByName[String(colorName || '').toLowerCase()] || 'bg-slate-300';

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
                    <div
                        ref={liveContainerRef}
                        className={`relative overflow-hidden border shadow-2xl border-white/10 bg-navy ${isFullscreen ? 'w-full h-full rounded-none' : 'aspect-video rounded-3xl'}`}
                    >
                        {shouldUseHls ? (
                            <video
                                ref={videoRef}
                                controls
                                muted={true}
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
                                <div className="text-center">
                                    <Loader2 size={40} className="mx-auto text-white opacity-90 animate-spin" />
                                    <p className="mt-3 text-[10px] font-black uppercase tracking-[0.18em] text-white/80">Auto play sedang menyiapkan stream...</p>
                                </div>
                            </div>
                        )}

                        <div className="absolute flex items-center gap-2 px-4 py-2 border top-5 left-5 rounded-xl border-white/20 bg-white/10 backdrop-blur-xl">
                            <Radio size={13} className="text-cyan-300" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-white/85">Live Mode</span>
                        </div>

                        <div className="absolute bottom-5 left-5">
                            <button
                                type="button"
                                onClick={handleToggleFullscreen}
                                className="inline-flex items-center justify-center gap-2 rounded-full border border-white/20 bg-black/45 px-4 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-white backdrop-blur-md hover:bg-black/60"
                                aria-label={isFullscreen ? 'Exit maximize' : 'Maximize stream'}
                                title={isFullscreen ? 'Exit maximize' : 'Maximize stream'}
                            >
                                {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                            </button>
                        </div>

                       
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

                    <div className="overflow-hidden border bg-gradient-to-b from-white to-slate-50 rounded-3xl border-navy/10">
                        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-navy/10">
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-navy/45">Smart Events</p>
                                <h3 className="mt-1 text-lg font-black text-navy">Human + Car Detection Feed</h3>
                            </div>
                            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-cyan-700">
                                <Sparkles size={12} />
                                Realtime
                            </div>
                        </div>
                        <div className="max-h-[660px] overflow-y-auto p-4">
                            <div className="grid grid-cols-1 gap-3 md:grid-cols-1">
                                {detectionFeed.length === 0 && (
                                    <div className="px-4 py-6 text-sm font-semibold border border-dashed rounded-2xl text-navy/55 border-navy/20 md:col-span-2">
                                        Belum ada event Human/Car realtime untuk channel ini.
                                    </div>
                                )}
                                {detectionFeed.map((item) => (
                                    <article key={item.id} className="overflow-hidden bg-white border shadow-sm rounded-2xl border-navy/10">
                                        <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-navy/10">
                                            <p className="text-xs font-black truncate text-navy">{selectedChannel?.channelName || selectedChannel?.name || `Channel ${form.channel}`}</p>
                                            <p className="text-[11px] font-bold text-navy/55">{item.time}</p>
                                        </div>
                                        <div className="grid grid-cols-[92px,1fr] gap-3 p-4">
                                            <img src={item.thumbUrl || `/uploads/snapshot/ch${item.channelId || form.channel}.jpeg`} alt={item.label} className="object-contain w-[92px] h-[150px] rounded-xl bg-slate-100" />
                                            <div className="space-y-2">
                                                {String(item.label || '').toLowerCase().includes('vehicle') ? (
                                                    <>
                                                        <div className="flex items-center gap-2 text-xs font-bold text-navy/80">
                                                            <Car size={14} />
                                                            <span>Vehicle</span>
                                                        </div>
                                                        <div className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-[10px] font-bold text-navy/75">
                                                            <Car size={11} />
                                                            Status: Detected
                                                        </div>
                                                    </>
                                                ) : (
                                                    <>
                                                        <div className="flex items-center gap-2 text-xs font-bold text-navy/80">
                                                            <Shirt size={14} />
                                                            <span className={`inline-block h-4 w-4 rounded-sm ${getColorBadgeClass(item.coatColor)}`} />
                                                            <span>{item.sleeves}</span>
                                                        </div>
                                                        <div className="flex items-center gap-2 text-xs font-bold text-navy/80">
                                                            <UserRound size={14} />
                                                            <span className={`inline-block h-4 w-4 rounded-sm ${getColorBadgeClass(item.lowerColor)}`} />
                                                            <span>{item.lowerType}</span>
                                                        </div>
                                                        <div className="grid grid-cols-2 gap-1.5 pt-1">
                                                            <div className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-[10px] font-bold text-navy/75">Sex: {item.sex}</div>
                                                            <div className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-[10px] font-bold text-navy/75">Age: {item.age}</div>
                                                            <div className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-[10px] font-bold text-navy/75"><Shirt size={11} />Hat: {item.hasHat}</div>
                                                            <div className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-[10px] font-bold text-navy/75"><Briefcase size={11} />Bag: {item.hasBag}</div>
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                        <div className="px-4 py-3 text-sm font-black border-t text-navy border-navy/10">{item.label}</div>
                                    </article>
                                ))}
                                {detectionError && (
                                    <div className="px-4 py-3 text-xs font-bold border rounded-xl border-amber-200 bg-amber-50 text-amber-700 md:col-span-2">
                                        {detectionError}
                                    </div>
                                )}
                            </div>
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

                        <div className="mt-5 rounded-xl border border-navy/15 bg-navy/[0.02] px-4 py-3 text-[10px] font-black uppercase tracking-widest text-navy/55">
                            {authCooldownRemainingSec > 0
                                ? `Auto play ditahan ${authCooldownRemainingSec} dtk untuk proteksi akun`
                                : (isSubmitting ? 'Auto play sedang menyiapkan stream...' : 'Auto play aktif: pilih channel langsung play')}
                        </div>

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
