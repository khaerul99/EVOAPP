import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    LayoutDashboard, Video, FileBarChart, ScanFace, PlayCircle,
    LogOut, Shield, ChevronLeft, X, Users, ChevronDown,
    Settings
} from 'lucide-react';
import { logout } from '../../stores/useStore';


const Sidebar = ({ isSidebarOpen, onToggleSidebar }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const [expandedGroups, setExpandedGroups] = useState({ dashboard: true, cctv: true, analytics: true, control: true });

    const menuGroups = [
        {
            id: 'dashboard',
            label: 'Dashboard',
            icon: LayoutDashboard,
            items: [
                { label: "Dashboard Overview", path: "/dashboard" },
                { label: "Activity Log", path: "/dashboard/activity" },
            ]
        },
        {
            id: 'cctv',
            label: 'CCTV Management',
            icon: Video,
            items: [
                { label: "Camera Management", path: "/dashboard/camera" },
            ]
        },
        {
            id: 'analytics',
            label: 'AI & Analytics',
            icon: FileBarChart,
            items: [
                { label: "People Counting", path: "/dashboard/people" },
                { label: "Analytics Report", path: "/dashboard/reports" },
            ]
        },
        {
            id: 'control',
            label: 'Data & Control',
            icon: PlayCircle,
            items: [
                { label: "Live Monitoring", path: "/dashboard/live" },
                { label: "Playback", path: "/dashboard/playback" },
                { label: "System Settings", path: "/dashboard/settings" },
            ]
        },
        {
            id: 'user',
            label: 'Management',
            icon: Users,
            items: [
                { label: "User Management", path: "/dashboard/users" },
                { label: "Face Recognition", path: "/dashboard/face" },
            ]
        },
    ];

    const toggleGroup = (groupId) => {
        setExpandedGroups(prev => ({
            ...prev,
            [groupId]: !prev[groupId]
        }));
    };

    const handleLogout = async () => {
        await logout();
        navigate('/login', { replace: true });
    }

    return (
        <aside className={`
            fixed inset-y-0 left-0 z-50 bg-[#0A0D14] flex flex-col shadow-2xl transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]
            
            /* MOBILE: Sembunyi total ke kiri (-translate) jika false */
            ${isSidebarOpen ? 'translate-x-0 w-72' : '-translate-x-full lg:translate-x-0 w-72 lg:w-24'}
        `}>
            
            {/* Logo Section */}
            <div className="relative flex items-center h-24 px-8 shrink-0">
                <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-10 h-10 bg-accent rounded-2xl">
                        <Shield className="text-navy" size={22} />
                    </div>
                    <AnimatePresence>
                        {isSidebarOpen && (
                            <motion.h1 
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -10 }}
                                className="text-xl font-black tracking-tighter text-white whitespace-nowrap"
                            >
                                EVO<span className="text-accent">SECURE</span>
                            </motion.h1>
                        )}
                    </AnimatePresence>
                </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
                {menuGroups.map((group) => {
                    const isExpanded = expandedGroups[group.id];
                    const hasActiveItem = group.items.some(item => location.pathname === item.path);
                    
                    return (
                        <div key={group.id} className="space-y-1">
                            {/* Group Header */}
                            <button
                                onClick={() => isSidebarOpen && toggleGroup(group.id)}
                                className={`group relative w-full flex items-center justify-between h-14 rounded-2xl transition-all duration-300 px-3
                                    ${hasActiveItem ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white hover:bg-white/5'}`}
                            >
                                <div className="flex items-center flex-1 min-w-0 gap-3">
                                    <div className={`flex items-center justify-center flex-shrink-0 transition-all duration-500`}>
                                        <group.icon size={22} className={hasActiveItem ? 'text-accent' : ''} />
                                    </div>
                                    
                                    {isSidebarOpen && (
                                        <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-sm font-bold tracking-wide truncate">
                                            {group.label}
                                        </motion.span>
                                    )}
                                </div>

                                {isSidebarOpen && (
                                    <motion.div
                                        animate={{ rotate: isExpanded ? 180 : 0 }}
                                        transition={{ duration: 0.3 }}
                                        className="flex-shrink-0"
                                    >
                                        <ChevronDown size={18} />
                                    </motion.div>
                                )}

                                {hasActiveItem && (
                                    <motion.div layoutId="activeIndicator" className="absolute left-0 w-1.5 h-6 rounded-full bg-accent" />
                                )}
                            </button>

                            {/* Group Items */}
                            <AnimatePresence>
                                {isSidebarOpen && isExpanded && (
                                    <motion.div
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: 'auto' }}
                                        exit={{ opacity: 0, height: 0 }}
                                        transition={{ duration: 0.3 }}
                                        className="space-y-1 overflow-hidden"
                                    >
                                        {group.items.map((item) => {
                                            const isActive = location.pathname === item.path;
                                            return (
                                                <button
                                                    key={item.path}
                                                    onClick={() => {
                                                        navigate(item.path);
                                                        if (window.innerWidth < 1024) onToggleSidebar();
                                                    }}
                                                    className={`group relative w-full flex items-center h-12 rounded-xl transition-all duration-300 pl-14 pr-3 text-left text-sm
                                                        ${isActive ? 'bg-accent/20 text-accent font-semibold' : 'text-white/50 hover:text-white/80 hover:bg-white/5'}`}
                                                >
                                                    {item.label}
                                                </button>
                                            );
                                        })}
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    );
                })}
            </nav>

            {/* Tombol Tutup Mobile */}
            {isSidebarOpen && (
                <button 
                    onClick={onToggleSidebar}
                    className="absolute top-8 right-6 text-white/20 hover:text-white lg:hidden"
                >
                    <X size={24} />
                </button>
            )}
            
            <div className="p-4 mt-auto border-t border-white/5">
                <button
                    onClick={handleLogout}
                    className="flex items-center w-full overflow-hidden text-red-500 transition-all duration-300 h-14 rounded-2xl bg-red-500/10 hover:bg-red-500 hover:text-white"
                >
                    <div className={`flex items-center justify-center ${isSidebarOpen ? 'w-16' : 'w-full'}`}>
                        <LogOut size={20} />
                    </div>
                    {isSidebarOpen && <span className="text-xs font-black tracking-widest uppercase">Logout</span>}
                </button>
            </div>
        </aside>
    );
};

export default Sidebar;
