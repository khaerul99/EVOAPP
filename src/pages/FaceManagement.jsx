import React from 'react';
import { ScanFace, UserPlus, Search, ShieldCheck, MoreVertical, ExternalLink } from 'lucide-react';

const FaceManagement = () => {
    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-black tracking-tight text-navy">FACE DATABASE</h2>
                <div className="flex items-center space-x-4">
                    <div className="relative">
                        <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-navy/30" />
                        <input
                            type="text"
                            placeholder="Find individual..."
                            className="pl-12 pr-4 py-2 bg-white border border-navy/5 rounded-xl text-xs font-bold outline-none focus:border-navy/20 transition-all w-64"
                        />
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
                {/* Registration Card */}
                <button className="bg-navy rounded-3xl p-8 flex flex-col items-center justify-center text-white space-y-4 hover:bg-navy/90 transition-all shadow-xl shadow-navy/10 group">
                    <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                        <UserPlus size={32} />
                    </div>
                    <div className="text-center">
                        <p className="font-black text-sm uppercase tracking-widest">Enroll Face</p>
                        <p className="text-[10px] text-white/40 mt-1 font-medium">Add new identification</p>
                    </div>
                </button>

                {[
                    { name: 'Rudy Hartono', role: 'Security Staff', img: 'https://images.unsplash.com/photo-1542909168-82c3e7fdca5c?auto=format&fit=crop&w=200&h=200' },
                    { name: 'Siska Amelia', role: 'Manager Admin', img: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=200&h=200' },
                    { name: 'Bamba Kaleb', role: 'Technician', img: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&h=200' },
                ].map((user, i) => (
                    <div key={i} className="bg-white p-6 rounded-3xl border border-navy/5 shadow-sm group">
                        <div className="relative mb-6">
                            <img src={user.img} className="w-full aspect-square object-cover rounded-2xl" alt={user.name} />
                            <div className="absolute top-3 right-3 p-2 bg-white/80 backdrop-blur rounded-full opacity-0 group-hover:opacity-100 transition-all cursor-pointer">
                                <ExternalLink size={14} className="text-navy" />
                            </div>
                        </div>
                        <div className="flex justify-between items-start">
                            <div>
                                <h4 className="font-black text-navy text-sm">{user.name}</h4>
                                <p className="text-[10px] font-bold text-navy/40 uppercase tracking-widest mt-1">{user.role}</p>
                            </div>
                            <div className="p-1 px-2 bg-success/10 text-success rounded-md flex items-center space-x-1">
                                <ShieldCheck size={10} />
                                <span className="text-[8px] font-black uppercase tracking-widest">Verified</span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <div className="bg-white rounded-3xl border border-navy/5 shadow-sm overflow-hidden">
                <div className="p-8 border-b border-navy/5 flex justify-between items-center">
                    <h3 className="font-black text-xs uppercase tracking-widest text-navy/40">Recent Recognition Logs</h3>
                    <button className="text-[10px] font-black uppercase tracking-widest text-navy border-b border-navy/10">Export Log</button>
                </div>
                <div className="p-8 space-y-4">
                    {[1, 2, 3].map(item => (
                        <div key={item} className="flex items-center justify-between p-4 bg-background rounded-2xl border border-navy/5">
                            <div className="flex items-center space-x-4">
                                <div className="w-10 h-10 bg-navy/5 rounded-xl flex items-center justify-center">
                                    <ScanFace size={20} className="text-navy" />
                                </div>
                                <div>
                                    <p className="text-xs font-bold text-navy">Identity Match Confirmed</p>
                                    <p className="text-[10px] text-navy/40 font-medium">Camera 01 - Main Entrance</p>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-[10px] font-mono font-bold text-navy/20">10:44:17</p>
                                <p className="text-[10px] font-black text-success uppercase">98% Accuracy</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default FaceManagement;
