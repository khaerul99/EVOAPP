import React from 'react';
import { PlayCircle, Rewind, FastForward, Calendar, Search, Scissors, Download, Clock } from 'lucide-react';

const Playback = () => {
    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-black tracking-tight text-navy">VIDEO PLAYBACK</h2>
                <div className="flex items-center space-x-4">
                    <div className="relative">
                        <Calendar size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-navy/30" />
                        <input
                            type="text"
                            defaultValue="2026-02-25"
                            className="pl-12 pr-4 py-2 bg-white border border-navy/5 rounded-xl text-xs font-bold outline-none focus:border-navy/20 transition-all w-48"
                        />
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                <div className="lg:col-span-3 space-y-6">
                    {/* Video Player */}
                    <div className="aspect-video bg-navy rounded-3xl overflow-hidden relative shadow-2xl group">
                        <div className="absolute inset-0 bg-slate-900/40 flex items-center justify-center">
                            <PlayCircle size={80} className="text-white opacity-40 group-hover:opacity-100 group-hover:scale-110 transition-all cursor-pointer" />
                        </div>
                        <div className="absolute inset-0 border-[16px] border-white/5 pointer-events-none" />

                        {/* Controls Overlay */}
                        <div className="absolute bottom-8 left-8 right-8">
                            <div className="bg-navy/80 backdrop-blur-md p-6 rounded-2xl border border-white/10">
                                <div className="flex items-center justify-between mb-6">
                                    <div className="flex items-center space-x-2">
                                        <div className="w-3 h-3 bg-danger rounded-full animate-pulse" />
                                        <span className="text-[10px] font-black uppercase text-white/60 tracking-widest">Recorded Stream</span>
                                    </div>
                                    <span className="text-xs font-mono text-white/40">10:44:17 / 18:00:00</span>
                                </div>

                                <div className="h-1 bg-white/10 rounded-full mb-8 relative group cursor-pointer">
                                    <div className="absolute top-0 left-0 h-full w-1/3 bg-white" />
                                    <div className="absolute top-1/2 left-1/3 -translate-x-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-all" />
                                </div>

                                <div className="flex items-center justify-between">
                                    <div className="flex items-center space-x-6">
                                        <Rewind size={20} className="text-white opacity-40 hover:opacity-100 cursor-pointer transition-all" />
                                        <PlayCircle size={32} className="text-white hover:scale-110 transition-all cursor-pointer" />
                                        <FastForward size={20} className="text-white opacity-40 hover:opacity-100 cursor-pointer transition-all" />
                                    </div>
                                    <div className="flex items-center space-x-4">
                                        <button className="p-2 bg-white/10 text-white rounded-lg hover:bg-white/20 transition-all">
                                            <Scissors size={16} />
                                        </button>
                                        <button className="p-2 bg-white text-navy rounded-lg hover:bg-white/90 transition-all">
                                            <Download size={16} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Timeline Controls */}
                    <div className="bg-white p-6 rounded-3xl border border-navy/5 shadow-sm">
                        <div className="flex justify-between items-center mb-6">
                            <span className="text-[10px] font-black uppercase tracking-widest text-navy/40">Timeline Explorer</span>
                            <div className="flex items-center space-x-1">
                                <Clock size={14} className="text-navy/20" />
                                <span className="text-[10px] font-black text-navy/40">24H VIEW</span>
                            </div>
                        </div>
                        <div className="grid grid-cols-24 gap-1 h-8">
                            {Array.from({ length: 24 }).map((_, i) => (
                                <div key={i} className={`h-full rounded-sm ${i > 8 && i < 16 ? 'bg-navy' : 'bg-navy/5'} opacity-80 cursor-pointer hover:opacity-100 transition-all`} />
                            ))}
                        </div>
                    </div>
                </div>

                <div className="space-y-6">
                    <div className="bg-white p-8 rounded-3xl border border-navy/5 shadow-sm h-full flex flex-col">
                        <h3 className="font-black text-xs uppercase tracking-widest text-navy/40 mb-8">Clip History</h3>
                        <div className="space-y-4 flex-1 overflow-y-auto">
                            {[
                                { name: 'Morning Shift', time: '08:00 - 10:00', size: '2.4 GB' },
                                { name: 'Lunch Hour', time: '12:00 - 13:00', size: '1.1 GB' },
                                { name: 'Late Event', time: '22:15 - 22:45', size: '640 MB' },
                                { name: 'Security Check', time: '02:00 - 02:15', size: '120 MB' },
                            ].map((clip, i) => (
                                <div key={i} className="p-4 bg-background rounded-2xl border border-navy/5 group cursor-pointer hover:border-navy/20 transition-all">
                                    <p className="text-xs font-black text-navy group-hover:text-navy">{clip.name}</p>
                                    <div className="flex justify-between items-center mt-2">
                                        <span className="text-[9px] font-bold text-navy/40 uppercase">{clip.time}</span>
                                        <span className="text-[9px] font-mono text-navy/20">{clip.size}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <button className="mt-8 w-full py-4 bg-navy/5 border border-navy/5 text-navy rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-navy hover:text-white transition-all">
                            Archive All Clips
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Playback;
