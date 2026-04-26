import React, { useMemo } from "react";
import {
  Users,
  Cctv,
  Activity,
  WifiOff,
  PlayCircle,
  ChevronRight,
  Shield,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { useDashboard } from "../../hooks/dashboard/useDashboard";
import { liveService } from "../../services/live/live.service";

const DashboardHome = () => {
  const {
    activeCamera,
    setActiveCamera,
    cameras,
    events,
    isFullscreen,
    currentDateTime,
    playerRef,
    stats,
    isLoading,
    error,
    handleToggleFullscreen,
  } = useDashboard();

  const hasActiveCamera = Boolean(activeCamera);
  const activeCameraLabel = hasActiveCamera
    ? activeCamera.channelName || activeCamera.name
    : "No Active Feed";
  const activeStreamSources = useMemo(() => {
    if (!hasActiveCamera) {
      return null;
    }

    const channel = Number(activeCamera.id);
    if (!Number.isFinite(channel) || channel < 1) {
      return null;
    }

    try {
      return liveService.buildLiveStreamSources({ channel, subtype: 0 });
    } catch {
      return null;
    }
  }, [activeCamera, hasActiveCamera]);
  const activePlayerUrl = activeStreamSources?.livePlayerUrl || "";
  const activeHlsUrl = activeStreamSources?.hlsUrl || "";
  const showPlayableStream =
    hasActiveCamera &&
    activeCamera.status === "online" &&
    Boolean(activePlayerUrl || activeHlsUrl);
  const cameraStreamSources = useMemo(() => {
    return cameras.reduce((accumulator, camera) => {
      const channel = Number(camera?.id);
      if (
        !Number.isFinite(channel) ||
        channel < 1 ||
        camera?.status !== "online"
      ) {
        return accumulator;
      }

      try {
        accumulator[camera.id] = liveService.buildLiveStreamSources({
          channel,
          subtype: 0,
        });
      } catch {
        accumulator[camera.id] = null;
      }
      return accumulator;
    }, {});
  }, [cameras]);
  const formatCount = (value) => new Intl.NumberFormat("id-ID").format(value);

  const StatCard = ({ icon: Icon, label, value, subtext }) => (
    <div className="flex flex-col justify-between p-5 transition-all duration-300 bg-white border border-navy/5 rounded-[24px] shadow-[0_10px_30px_rgba(15,23,42,0.05)] hover:-translate-y-0.5 hover:shadow-[0_16px_40px_rgba(15,23,42,0.08)] group">
      <div className="flex items-start justify-between mb-5">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-navy/35 mb-2">
            {label}
          </p>
          <h3 className="text-[2rem] font-black tracking-tight text-navy leading-none">
            {value}
          </h3>
        </div>
        <div className="p-3 transition-all duration-300 border bg-navy/[0.03] rounded-2xl border-navy/5 group-hover:bg-navy/[0.05]">
          <Icon size={22} className="text-navy/55" />
        </div>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-[9px] font-semibold uppercase tracking-[0.18em] text-navy/28">
          {subtext}
        </span>
        <ChevronRight size={14} className="text-navy/18" />
      </div>
    </div>
  );

  return (
    <div className="space-y-6 duration-500 md:space-y-8 animate-in fade-in slide-in-from-bottom-4">
      {(isLoading || error) && (
        <div
          className={`p-4 rounded-2xl border ${error ? "bg-danger/10 border-danger/20 text-danger" : "bg-white border-navy/10 text-navy/60"} shadow-sm`}
        >
          <p className="text-xs font-semibold tracking-[0.2em] uppercase">
            {isLoading ? "Memuat data kamera dan security log." : error}
          </p>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 md:gap-6">
        <StatCard
          icon={Users}
          label="Flow Insight"
          value={formatCount(stats.peopleCount)}
          subtext="Real-time occupancy"
        />
        <StatCard
          icon={Cctv}
          label="Fleet Integrity"
          value={`${stats.onlineCams}/${stats.totalCams}`}
          subtext={`${stats.offlineCams} Units Offline`}
        />
      </div>

     

      <div className="space-y-5 md:space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-2 h-6 rounded-full bg-navy/70" />
            <h3 className="text-lg font-black tracking-[0.18em] uppercase text-navy">
              Live Intelligence Feed
            </h3>
          </div>
          <div className="flex items-center space-x-4">
            <span className="text-[10px] font-black text-navy/30 uppercase tracking-[0.22em] bg-white px-4 py-2 rounded-full border border-navy/5 shadow-sm">
              {stats.totalCams > 0
                ? `${stats.onlineCams}/${stats.totalCams} Online`
                : "No Cameras"}
            </span>
          </div>
        </div>

        {/* Main Player */}
        <div
          ref={playerRef}
          className={`${isFullscreen ? "w-full h-full rounded-none border-0" : "aspect-[4/3] md:aspect-video rounded-[28px] md:rounded-[36px] border border-navy/5"} bg-[#1c3551] overflow-hidden relative shadow-[0_20px_60px_rgba(15,23,42,0.12)] group transition-all duration-300`}
        >
          {showPlayableStream ? (
            <>
              <iframe
                title={activeCameraLabel}
                src={activePlayerUrl || activeHlsUrl}
                className="absolute inset-0 w-full h-full border-0"
                allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
                allowFullScreen
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/65 via-slate-950/10 to-transparent" />
              <div className="absolute bottom-6 left-6 md:bottom-10 md:left-10">
                <div className="flex items-center mb-2 space-x-2">
                  <span className="px-2.5 py-1 bg-emerald-500 text-white text-[8px] font-black uppercase tracking-[0.18em] rounded-full shadow-lg shadow-emerald-500/20">
                    Online
                  </span>
                  <span className="text-white/50 text-[8px] md:text-[10px] font-mono">
                    {activeCamera.ip}
                  </span>
                </div>
                <h4 className="text-2xl font-black tracking-tight text-white md:text-4xl">
                  {activeCameraLabel}
                </h4>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center w-full h-full px-6 text-center">
              {isLoading ? (
                <Activity
                  size={56}
                  className="mb-5 text-white/20 animate-pulse"
                />
              ) : showPlayableStream ? (
                <PlayCircle size={56} className="mb-5 text-white/20" />
              ) : (
                <WifiOff
                  size={56}
                  className="mb-5 text-white/10 animate-pulse"
                />
              )}
              <p className="text-base md:text-lg font-black tracking-[0.22em] uppercase text-white/20">
                {isLoading
                  ? "Syncing Camera Registry"
                  : showPlayableStream
                    ? "Paused"
                    : "System Disconnected"}
              </p>
              <p className="mt-2 text-xs font-medium tracking-wide text-white/35 max-w-[22rem] leading-relaxed">
                {isLoading
                  ? "Menunggu data kamera terbaru dari perangkat."
                  : showPlayableStream
                    ? "Tekan Play untuk memulai stream kamera aktif."
                    : "Tidak ada feed aktif untuk ditampilkan saat ini."}
              </p>
            </div>
          )}
          <div className="absolute px-3 py-2 text-white border top-4 left-4 md:top-6 md:left-6 rounded-2xl bg-black/20 backdrop-blur-md border-white/10">
            <p className="text-[8px] font-semibold tracking-[0.22em] uppercase text-white/70">
              {currentDateTime.toLocaleDateString("id-ID", {
                weekday: "short",
                year: "numeric",
                month: "short",
                day: "numeric",
              })}
            </p>
            <p className="mt-1 text-[10px] font-mono font-medium text-white/90">
              {currentDateTime.toLocaleTimeString("id-ID")}
            </p>
          </div>

          <div className="absolute inset-x-0 right-0 flex justify-end px-4 bottom-5 md:bottom-8">
            <button
              type="button"
              onClick={handleToggleFullscreen}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-white/10 bg-slate-900/70 px-5 py-4 text-xs font-black uppercase tracking-[0.22em] text-white backdrop-blur-md shadow-lg shadow-slate-950/20 hover:bg-slate-900"
              aria-label={isFullscreen ? "Exit maximize" : "Maximize stream"}
              title={isFullscreen ? "Exit maximize" : "Maximize stream"}
            >
              {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 md:gap-5">
          {cameras.filter((camera) => camera.status === "online").length > 0 ? (
            cameras
              .filter(
                (camera) =>
                  camera.status === "online" && camera.id !== activeCamera?.id,
              )
              .map((cam) => (
                <button
                  key={cam.id}
                  onClick={() => setActiveCamera(cam)}
                  className="aspect-[2/4] md:aspect-video bg-white rounded-[20px] md:rounded-[26px] overflow-hidden relative border border-navy/5 shadow-sm group transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md"
                >
                  {cameraStreamSources[cam.id] ? (
                    <iframe
                      title={cam.channelName || cam.name}
                      src={
                        cameraStreamSources[cam.id].livePlayerUrl ||
                        cameraStreamSources[cam.id].hlsUrl
                      }
                      className="absolute inset-0 w-full h-full border-0"
                      allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
                      allowFullScreen
                    />
                  ) : (
                    <img
                      src={cam.thumbnail}
                      className="object-cover w-full h-full transition-all duration-700 scale-105 opacity-70 group-hover:opacity-90 group-hover:scale-100"
                      alt="thumb"
                    />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/75 via-slate-950/10 to-transparent" />
                  <div className="absolute px-3 py-2 transition-all duration-300 border inset-x-3 bottom-3 bg-black/30 backdrop-blur-md rounded-2xl border-white/10">
                    <span className="text-[9px] font-black text-white uppercase tracking-[0.18em]">
                      {cam.channelName || cam.name}
                    </span>
                  </div>
                </button>
              ))
          ) : (
            <div className="col-span-2 p-6 text-center bg-white border border-dashed md:col-span-3 rounded-2xl border-navy/10 text-navy/40">
              <p className="text-xs font-black tracking-[0.22em] uppercase">
                No online camera feeds available
              </p>
            </div>
          )}
         
        </div>
      </div>

       <div className=" space-y-8 p-5 bg-white border rounded-[24px] border-navy/5 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-black tracking-[0.18em] uppercase text-navy">
            Event Log
          </h3>
          <span className="text-[10px] font-black uppercase tracking-[0.18em] text-navy/40">
            {events.length} events
          </span>
        </div>
        <div className="mt-4 space-y-2">
          {events.length > 0 ? (
            events.map((event) => (
              <div
                key={event.id}
                className="rounded-xl border border-navy/10 bg-slate-50/70 px-3 py-2.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[10px] font-black uppercase tracking-widest text-navy/70">
                    {event.type || "Security Event"}
                  </p>
                  <p className="font-mono text-[10px] font-bold text-navy/55">
                    {event.time || "-"}
                  </p>
                </div>
                <p className="mt-1 text-xs font-semibold text-slate-800">
                  {event.camera || "System"}
                </p>
                <p className="mt-1 text-[11px] text-slate-600">
                  {event.detail || "-"}
                </p>
              </div>
            ))
          ) : (
            <div className="rounded-xl border border-dashed border-navy/15 bg-navy/[0.02] p-4 text-center">
              <p className="text-[10px] font-black uppercase tracking-widest text-navy/45">
                Belum ada event
              </p>
              <p className="mt-1 text-[11px] text-navy/55">
                Event keamanan akan tampil otomatis di sini.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DashboardHome;
