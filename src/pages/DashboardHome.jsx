import React, { useState, useEffect, useRef } from 'react';
import {
    Users, ScanFace, Brain, Cctv, Activity, Wifi, WifiOff,
    ChevronRight, MapPin, Shield, PlayCircle, Maximize, Minimize
} from 'lucide-react';

const INITIAL_CAMERAS = [
    { id: 1, name: 'Lobby Utama - Unit A1', status: 'Online', ip: '192.168.1.101', thumbnail: 'https://images.unsplash.com/photo-1497366811353-6870744d04b2?auto=format&fit=crop&w=800&q=80' },
    { id: 2, name: 'Area Parkir Timur', status: 'Online', ip: '192.168.1.102', thumbnail: 'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&w=800&q=80' },
    { id: 3, name: 'Ruang Server Tier 3', status: 'Offline', ip: '192.168.1.105', thumbnail: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=800&q=80' },
];

const INITIAL_EVENTS = [
    { id: 1, type: 'Face Recognized', camera: 'Lobby Utama', time: '10:15:30', detail: 'User: Ryujin (Staff)', severity: 'info' },
    { id: 2, type: 'People Count Detected', camera: 'Area Parkir', time: '10:14:02', detail: '4 people detected', severity: 'info' },
    { id: 3, type: 'Camera Offline', camera: 'Ruang Server', time: '10:12:45', detail: 'Connection lost (IVSS Error)', severity: 'warning' },
    { id: 4, type: 'Face Detected', camera: 'Pintu Keluar', time: '10:10:12', detail: 'Unknown face detected', severity: 'info' },
    { id: 5, type: 'System Reboot', camera: 'Gateway 1', time: '09:00:00', detail: 'Scheduled maintenance', severity: 'success' },
];

const DashboardHome = () => {
    const [activeCamera, setActiveCamera] = useState(INITIAL_CAMERAS[0]);
    const [cameras] = useState(INITIAL_CAMERAS);
    const [events, setEvents] = useState(INITIAL_EVENTS);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [currentDateTime, setCurrentDateTime] = useState(new Date());
    const playerRef = useRef(null);
    const [stats, setStats] = useState({
        peopleCount: 124,
        faceDetected: 86,
        faceRecognized: 42,
        totalCams: 18,
        onlineCams: 15,
        offlineCams: 3
    });

    useEffect(() => {
        const clockTimer = setInterval(() => setCurrentDateTime(new Date()), 1000);
        return () => clearInterval(clockTimer);
    }, []);

    useEffect(() => {
        const timer = setInterval(() => {
            setStats(prev => ({
                ...prev,
                peopleCount: prev.peopleCount + (Math.random() > 0.8 ? 1 : 0),
                faceDetected: prev.faceDetected + (Math.random() > 0.9 ? 1 : 0),
                faceRecognized: prev.faceRecognized + (Math.random() > 0.95 ? 1 : 0),
            }));

            if (Math.random() > 0.97) {
                const newEvent = {
                    id: Date.now(),
                    type: ['Face Detected', 'People Count Detected', 'Camera Online'][Math.floor(Math.random() * 3)],
                    camera: activeCamera.name,
                    time: new Date().toLocaleTimeString('id-ID'),
                    detail: 'Auto-refreshed security event',
                    severity: 'info'
                };
                setEvents(prev => [newEvent, ...prev.slice(0, 4)]);
            }
        }, 3000);

        return () => clearInterval(timer);
    }, [activeCamera.name]);

    useEffect(() => {
        const handleFullscreenChange = () => {
            setIsFullscreen(!!document.fullscreenElement);
        };
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
    }, []);

    const handleToggleFullscreen = async () => {
        try {
            if (!document.fullscreenElement) {
                if (playerRef.current?.requestFullscreen) {
                    await playerRef.current.requestFullscreen();
                }
            } else {
                if (document.exitFullscreen) {
                    await document.exitFullscreen();
                }
            }
        } catch (err) {
            console.error("Error attempting to enable fullscreen:", err);
        }
    };

    const StatCard = ({ icon: Icon, label, value, subtext }) => (
        <div className="bg-white p-6 rounded-3xl border border-navy/5 shadow-sm hover:shadow-xl hover:shadow-navy/5 transition-all duration-500 flex flex-col justify-between group">
            <div className="flex justify-between items-start mb-4">
                <div>
                    <p className="text-[10px] font-black opacity-40 uppercase tracking-widest mb-1">{label}</p>
                    <h3 className="text-3xl font-black text-navy tracking-tight">{value}</h3>
                </div>
                <div className="p-3 bg-background rounded-2xl border border-navy/5 group-hover:scale-110 transition-all duration-500">
                    <Icon size={24} className="text-navy opacity-60" />
                </div>
            </div>
            <div className="flex items-center justify-between">
                <span className="text-[9px] font-black opacity-30 uppercase tracking-tighter">{subtext}</span>
                <div className="w-8 h-8 rounded-full bg-background flex items-center justify-center text-navy/20 group-hover:text-navy transition-colors">
                    <ChevronRight size={14} />
                </div>
            </div>
        </div>
    );

    return (
        <div className="space-y-6 md:space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Stats Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-8">
                <StatCard icon={Users} label="Flow Insight" value={stats.peopleCount} subtext="Real-time occupancy" />
                <StatCard icon={ScanFace} label="Activity Density" value={stats.faceDetected} subtext="Global detections" />
                <StatCard icon={Brain} label="Identity Matches" value={stats.faceRecognized} subtext="Verified entries" />
                <StatCard icon={Cctv} label="Fleet Integrity" value={`${stats.onlineCams}/${stats.totalCams}`} subtext={`${stats.offlineCams} Units Offline`} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-10">
                <div className="col-span-1 lg:col-span-2 space-y-6 md:space-y-8">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                            <div className="w-2 h-8 bg-navy rounded-full" />
                            <h3 className="font-black text-xl tracking-tight uppercase">Live Intelligence Feed</h3>
                        </div>
                        <div className="flex items-center space-x-4">
                            <span className="text-[10px] font-black text-navy/20 uppercase tracking-widest bg-white px-4 py-2 rounded-xl">Channel 01-A</span>
                        </div>
                    </div>

                    {/* Main Player */}
                    <div ref={playerRef} className={`${isFullscreen ? 'w-full h-full rounded-none border-0' : 'aspect-[4/3] md:aspect-video rounded-3xl md:rounded-[40px] border-[6px] md:border-[12px] border-white ring-1 ring-navy/5'} bg-navy overflow-hidden relative shadow-2xl group transition-all duration-500`}>
                        {activeCamera.status === 'Online' ? (
                            <>
                                <img src={activeCamera.thumbnail} className="w-full h-full object-cover opacity-90 scale-105 group-hover:scale-100 transition-all duration-1000" alt="CCTV" />
                                <div className="absolute inset-0 bg-gradient-to-t from-navy/90 via-navy/20 to-transparent" />
                                <div className="absolute bottom-6 left-6 md:bottom-12 md:left-12">
                                    <div className="flex items-center space-x-2 md:space-x-3 mb-2 md:mb-3">
                                        <span className="px-2 md:px-3 py-1 bg-success text-white text-[8px] md:text-[9px] font-black uppercase tracking-widest rounded-full shadow-lg shadow-success/20">Secured</span>
                                        <span className="text-white/40 text-[8px] md:text-[10px] font-mono">{activeCamera.ip}</span>
                                    </div>
                                    <h4 className="text-2xl md:text-4xl font-black text-white tracking-tighter">{activeCamera.name}</h4>
                                </div>
                            </>
                        ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center">
                                <WifiOff size={64} className="text-white/10 mb-6 animate-pulse" />
                                <p className="text-white/20 font-black uppercase tracking-widest text-lg">System Disconnected</p>
                            </div>
                        )}
                        {/* HUD Overlay */}
                        <div className="absolute top-4 left-4 md:top-10 md:left-10 p-2 md:p-4 border-l md:border-t-0 border-t border-white/20 rounded-tl-xl md:rounded-tl-2xl pointer-events-none">
                            <div className="text-white drop-shadow-md">
                                <p className="text-[8px] md:text-[10px] font-black tracking-widest uppercase opacity-80">
                                    {currentDateTime.toLocaleDateString('id-ID', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
                                </p>
                                <p className="text-[10px] md:text-xs font-mono font-bold mt-0.5 md:mt-1">
                                    {currentDateTime.toLocaleTimeString('id-ID')}
                                </p>
                            </div>
                        </div>
                        
                        <div className="absolute top-4 right-4 md:top-10 md:right-10 flex items-center space-x-4">
                            <div className="p-4 border-r border-t border-white/20 rounded-tr-2xl pointer-events-none absolute right-0 top-0 w-full h-full hidden" />
                            <button onClick={handleToggleFullscreen} className="relative z-10 p-2 md:p-3 bg-black/40 backdrop-blur-xl rounded-xl md:rounded-2xl border border-white/10 text-white hover:scale-110 transition-transform cursor-pointer md:opacity-0 group-hover:opacity-100">
                                {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
                            </button>
                        </div>

                        <div className="absolute bottom-4 right-4 md:bottom-10 md:right-10 flex items-center space-x-3 md:space-x-4 bg-black/40 backdrop-blur-xl p-3 md:p-4 rounded-2xl md:rounded-3xl border border-white/10">
                            <PlayCircle className="text-white cursor-pointer hover:scale-110 transition-transform w-[24px] h-[24px] md:w-[32px] md:h-[32px]" />
                            <div className="text-right">
                                <p className="text-[8px] md:text-[10px] font-black text-white/40 uppercase">Recording Status</p>
                                <p className="text-[10px] md:text-xs font-bold text-white uppercase tracking-widest">Active · 60fps</p>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
                        {cameras.filter(c => c.id !== activeCamera.id).map(cam => (
                            <button key={cam.id} onClick={() => setActiveCamera(cam)} className="aspect-[4/3] md:aspect-video bg-navy rounded-2xl md:rounded-[32px] overflow-hidden relative border-4 border-transparent hover:border-navy transition-all duration-500 shadow-lg group">
                                <img src={cam.thumbnail} className="w-full h-full object-cover opacity-60 group-hover:opacity-100 scale-110 group-hover:scale-100 transition-all duration-700" alt="thumb" />
                                <div className="absolute inset-x-4 bottom-4 bg-black/40 backdrop-blur px-3 py-2 rounded-2xl border border-white/10 translate-y-2 group-hover:translate-y-0 transition-all duration-500">
                                    <span className="text-[10px] font-black text-white uppercase tracking-tight">{cam.name}</span>
                                </div>
                            </button>
                        ))}
                        <button className="aspect-[4/3] md:aspect-video bg-white rounded-2xl md:rounded-[32px] border-4 border-dashed border-navy/5 flex flex-col items-center justify-center text-navy/10 hover:text-navy/20 hover:bg-navy/5 transition-all duration-500">
                            <div className="w-8 h-8 md:w-10 md:h-10 bg-background rounded-xl md:rounded-2xl flex items-center justify-center mb-1 text-xs md:text-base">
                                <Shield size={16} className="md:w-[20px]" />
                            </div>
                            <span className="text-[8px] md:text-[10px] font-black uppercase tracking-widest">Enroll Feed</span>
                        </button>
                    </div>
                </div>

                <div className="space-y-8">
                    <div className="flex items-center space-x-3">
                        <div className="w-2 h-8 bg-accent rounded-full" />
                        <h3 className="font-black text-xl tracking-tight uppercase">Security Pulse</h3>
                    </div>

                    <div className="bg-white rounded-[40px] border border-navy/5 shadow-2xl shadow-navy/5 overflow-hidden flex flex-col h-[500px] md:h-[700px]">
                        <div className="p-6 md:p-10 border-b border-navy/5 flex items-center justify-between">
                            <div className="space-y-1">
                                <p className="text-[10px] font-black text-navy/40 uppercase tracking-[0.2em] md:tracking-[0.2em]">Latest Findings</p>
                                <h4 className="text-xl md:text-2xl font-black text-navy tracking-tighter underline decoration-success decoration-4 underline-offset-4">Event Log</h4>
                            </div>
                            <div className="w-10 h-10 md:w-12 md:h-12 bg-background rounded-full flex items-center justify-center">
                                <Activity className="text-navy opacity-20" size={20} />
                            </div>
                        </div>

                        <div className="p-6 md:p-10 flex-1 space-y-8 md:space-y-10 overflow-y-auto">
                            {events.map((event, i) => (
                                <div key={event.id} className="group relative pl-10 animate-in fade-in slide-in-from-right-4 duration-500" style={{ animationDelay: `${i * 100}ms` }}>
                                    <div className="absolute left-0 top-1.5 w-4 h-4 rounded-full bg-background border-4 border-white shadow-xl shadow-navy/5 group-hover:scale-125 transition-all duration-500" />
                                    <div className="absolute left-[7px] top-5 w-0.5 h-full bg-navy/5 last:hidden" />

                                    <div className="flex justify-between items-start mb-2">
                                        <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full ${event.severity === 'warning' ? 'bg-danger/10 text-danger' : 'bg-navy/5 text-navy/60'
                                            }`}>{event.type}</span>
                                        <span className="text-[10px] font-mono font-black opacity-20 bg-background px-2 py-1 rounded">{event.time}</span>
                                    </div>
                                    <p className="text-sm font-black text-navy leading-tight">{event.camera}</p>
                                    <p className="text-[10px] opacity-40 mt-1 font-bold italic">Protocol override check: {event.detail}</p>
                                </div>
                            ))}
                        </div>

                        <div className="p-10 bg-background/50 backdrop-blur rounded-b-[40px]">
                            <button className="w-full py-5 bg-navy text-white rounded-[24px] text-xs font-black uppercase tracking-[0.2em] hover:bg-navy/90 transition-all shadow-2xl shadow-navy/20 active:scale-95">
                                Generate Analytic Report
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DashboardHome;
