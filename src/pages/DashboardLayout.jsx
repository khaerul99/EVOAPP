import React, { useState, useEffect } from 'react';
import { useNavigate, Outlet, useLocation } from 'react-router-dom';
import {
    Users, ScanFace, Brain, Cctv, Bell, LogOut,
    LayoutDashboard, Video, FileBarChart, PlayCircle,
    User as UserIcon, Settings, Shield, ChevronRight,
    Menu, X
} from 'lucide-react';
import { useDashboard } from '../hooks/useDashboard';

const DashboardLayout = () => {
    const [currentTime, setCurrentTime] = useState(new Date().toLocaleTimeString('id-ID'));
    const [showNotifications, setShowNotifications] = useState(false);
    const [showAccountMenu, setShowAccountMenu] = useState(false);
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);

    const navigate = useNavigate();
    const location = useLocation();
    const { logout, username } = useDashboard();

    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentTime(new Date().toLocaleTimeString('id-ID'));
        }, 3000);
        return () => clearInterval(timer);
    }, []);

    const handleLogout = async () => {
        await logout();
    };

    const SidebarItem = ({ icon: Icon, label, path }) => {
        const isActive = location.pathname === path || (path === '/dashboard' && location.pathname === '/dashboard/');
        return (
            <button
                onClick={() => navigate(path)}
                className={`w-full flex items-center ${isSidebarOpen ? 'space-x-3 px-6' : 'justify-center px-0'} py-4 transition-all duration-300 ${isActive ? 'bg-accent text-navy shadow-inner' : 'text-white/60 hover:text-white hover:bg-white/5'} rounded-xl`}
            >
                <Icon size={20} className={`${isActive ? 'animate-pulse' : ''} shrink-0`} />
                {isSidebarOpen && <span className="font-bold text-sm tracking-wide">{label}</span>}
            </button>
        );
    };

    return (
        <div className="h-screen flex bg-background text-navy overflow-hidden relative">
            {/* Mobile Backdrop */}
            {isSidebarOpen && (
                <div className="fixed inset-0 bg-navy/50 backdrop-blur-sm z-40 md:hidden" onClick={() => setIsSidebarOpen(false)} />
            )}

            {/* Sidebar */}
            <aside className={`bg-navy flex flex-col shrink-0 transition-all duration-500 ease-in-out z-50 fixed md:relative h-full ${isSidebarOpen ? 'w-72 translate-x-0' : '-translate-x-full w-72 md:w-20 md:translate-x-0'}`}>
                <div className="p-6 md:p-10 flex items-center justify-between">
                    {isSidebarOpen && <h1 className="text-2xl font-black text-white tracking-tighter animate-in fade-in duration-700">EVOSECURE</h1>}
                    {!isSidebarOpen && <Shield className="text-white animate-in zoom-in" size={24} />}
                </div>

                <nav className="flex-1 px-4 space-y-2 overflow-hidden">
                    <SidebarItem icon={LayoutDashboard} label="Dashboard" path="/dashboard" />
                    <SidebarItem icon={Video} label="Camera Management" path="/dashboard/camera" />
                    <SidebarItem icon={FileBarChart} label="Reports" path="/dashboard/reports" />
                    <SidebarItem icon={ScanFace} label="Face Management" path="/dashboard/face" />
                    <SidebarItem icon={PlayCircle} label="Playback" path="/dashboard/playback" />
                </nav>

                <div className="p-8 mt-auto flex flex-col space-y-4">
                    <button onClick={handleLogout} className="flex items-center space-x-3 text-white/40 hover:text-danger hover:bg-danger/5 p-3 rounded-xl transition-all font-bold text-xs uppercase tracking-widest border border-transparent hover:border-danger/10">
                        <LogOut size={18} />
                        {isSidebarOpen && <span>Logout</span>}
                    </button>
                    {isSidebarOpen && (
                        <div className="pt-4 border-t border-white/5">
                            <p className="text-[9px] text-white/20 font-black uppercase tracking-widest text-center">Copyright © EVONIX v1.0</p>
                        </div>
                    )}
                </div>
            </aside>

            {/* Main Content Area */}
            <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
                {/* Header */}
                <header className="h-20 bg-white flex items-center justify-between px-4 md:px-10 shrink-0 z-30 border-b border-navy/5 relative">
                    <div className="flex items-center space-x-4 md:space-x-6">
                        <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 hover:bg-background rounded-xl transition-colors">
                            {isSidebarOpen ? <Menu size={20} /> : <X size={20} />}
                        </button>
                        <div className="hidden md:flex items-center space-x-4">
                            <span className="text-xs font-black uppercase tracking-widest opacity-30">Site Manager</span>
                            <ChevronRight size={14} className="opacity-10" />
                            <span className="text-xs font-black uppercase tracking-widest text-navy underline decoration-accent decoration-4 underline-offset-4">
                                {location.pathname.split('/').pop().toUpperCase() || 'DASHBOARD'}
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center space-x-3 md:space-x-6">
                        <div className="hidden lg:flex text-right flex-col items-end mr-4">
                            <span className="text-[10px] font-black opacity-30 uppercase tracking-tighter">System Pulse</span>
                            <span className="text-xs font-bold font-mono tracking-widest shadow-sm px-2 bg-background rounded">{currentTime}</span>
                        </div>

                        {/* Notification Dropdown */}
                        <div className="relative">
                            <button
                                onClick={() => { setShowNotifications(!showNotifications); setShowAccountMenu(false); }}
                                className={`relative p-2.5 rounded-xl transition-all duration-300 ${showNotifications ? 'bg-navy text-white shadow-xl rotate-12' : 'bg-navy/5 text-navy hover:bg-navy/10'}`}
                            >
                                <Bell size={20} />
                                <span className="absolute top-2 right-2 w-2 h-2 bg-danger rounded-full border-2 border-white animate-ping" />
                            </button>

                            {showNotifications && (
                                <>
                                    <div className="fixed inset-0 z-40" onClick={() => setShowNotifications(false)} />
                                    <div className="absolute right-0 mt-4 w-80 bg-white rounded-3xl shadow-2xl border border-navy/5 z-50 overflow-hidden animate-in fade-in slide-in-from-top-4 duration-300">
                                        <div className="p-5 bg-navy text-white flex justify-between items-center">
                                            <span className="text-[10px] font-black uppercase tracking-widest">Global Notifications</span>
                                            <span className="px-2 py-0.5 bg-danger rounded text-[9px] font-black tracking-tighter">URGENT</span>
                                        </div>
                                        <div className="max-h-96 overflow-y-auto">
                                            {[1, 2, 3].map(i => (
                                                <div key={i} className="p-5 border-b border-navy/5 hover:bg-background transition-all cursor-pointer group">
                                                    <div className="flex justify-between items-start mb-2">
                                                        <span className="text-[10px] font-black uppercase tracking-widest text-navy/40 group-hover:text-navy">Motion Detection</span>
                                                        <span className="text-[9px] font-mono opacity-20">2 MINS AGO</span>
                                                    </div>
                                                    <p className="text-xs font-bold text-navy">Lobby Utama activity detected</p>
                                                </div>
                                            ))}
                                        </div>
                                        <button className="w-full py-4 text-[10px] font-black uppercase text-navy hover:bg-background transition-colors border-t border-navy/5">
                                            Clear All Notifications
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Account Dropdown */}
                        <div className="relative">
                            <button
                                onClick={() => { setShowAccountMenu(!showAccountMenu); setShowNotifications(false); }}
                                className={`flex items-center space-x-3 p-1.5 pr-4 rounded-2xl transition-all border ${showAccountMenu ? 'bg-navy border-navy text-white shadow-xl scale-105' : 'bg-background border-transparent hover:border-navy/10'}`}
                            >
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center border transition-all ${showAccountMenu ? 'bg-white/20 border-white/20 rotate-180' : 'bg-navy/10 border-navy/5'}`}>
                                    <UserIcon size={16} className={showAccountMenu ? 'text-white' : 'text-navy text-opacity-40'} />
                                </div>
                                <span className="text-xs font-black tracking-tight uppercase">{username}</span>
                            </button>

                            {showAccountMenu && (
                                <>
                                    <div className="fixed inset-0 z-40" onClick={() => setShowAccountMenu(false)} />
                                    <div className="absolute right-0 mt-4 w-64 bg-white rounded-3xl shadow-2xl border border-navy/5 z-50 overflow-hidden animate-in fade-in slide-in-from-top-4 duration-300">
                                        <div className="p-6 bg-background border-b border-navy/5">
                                            <p className="text-[10px] font-black text-navy opacity-40 uppercase tracking-widest">Active User</p>
                                            <p className="text-sm font-black text-navy mt-1 truncate tracking-tight">{username}</p>
                                        </div>
                                        <div className="p-3 space-y-1">
                                            {[
                                                { icon: UserIcon, label: 'Management Profile' },
                                                { icon: Settings, label: 'System Configuration' },
                                                { icon: Shield, label: 'Security Protocols' }
                                            ].map((item, i) => (
                                                <button key={i} className="w-full flex items-center space-x-3 px-4 py-3 hover:bg-background rounded-2xl transition-all text-xs font-bold text-navy/60 hover:text-navy">
                                                    <item.icon size={16} />
                                                    <span>{item.label}</span>
                                                </button>
                                            ))}
                                        </div>
                                        <div className="p-4 border-t border-navy/5">
                                            <button onClick={handleLogout} className="w-full flex items-center justify-center space-x-3 py-4 bg-danger/5 hover:bg-danger/10 rounded-2xl transition-all text-[10px] font-black uppercase text-danger tracking-widest">
                                                <LogOut size={16} />
                                                <span>Terminate Session</span>
                                            </button>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </header>

                {/* Outlet for Nested Routes */}
                <div className="flex-1 overflow-y-auto p-4 md:p-10 bg-background/50 relative">
                    <Outlet />
                </div>
            </main>
        </div>
    );
};

export default DashboardLayout;
