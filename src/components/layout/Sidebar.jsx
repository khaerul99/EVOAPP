import React from 'react'
import { FileBarChart, LayoutDashboard, LogOut, PlayCircle, ScanFace, Shield, Video } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'

const Sidebar = ({ isSidebarOpen, onCloseMobile, onLogout }) => {
    const navigate = useNavigate()
    const location = useLocation()

    const items = [
        { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
        { icon: Video, label: 'Camera Management', path: '/dashboard/camera' },
        { icon: FileBarChart, label: 'Reports', path: '/dashboard/reports' },
        { icon: ScanFace, label: 'Face Management', path: '/dashboard/face' },
        { icon: PlayCircle, label: 'Playback', path: '/dashboard/playback' },
    ]

    return (
        <>
            {isSidebarOpen && (
                <div className="fixed inset-0 bg-navy/50 backdrop-blur-sm z-40 md:hidden" onClick={onCloseMobile} />
            )}
            <aside className={`bg-navy flex flex-col shrink-0 transition-all duration-500 ease-in-out z-50 fixed md:relative h-full ${isSidebarOpen ? 'w-72 translate-x-0' : '-translate-x-full w-72 md:w-20 md:translate-x-0'}`}>
                <div className="p-6 md:p-10 flex items-center justify-between">
                    {isSidebarOpen && <h1 className="text-2xl font-black text-white tracking-tighter animate-in fade-in duration-700">EVOSECURE</h1>}
                    {!isSidebarOpen && <Shield className="text-white animate-in zoom-in" size={24} />}
                </div>

                <nav className="flex-1 px-4 space-y-2 overflow-hidden">
                    {items.map((item) => {
                        const isActive = location.pathname === item.path || (item.path === '/dashboard' && location.pathname === '/dashboard/')
                        const Icon = item.icon
                        return (
                            <button
                                key={item.path}
                                onClick={() => navigate(item.path)}
                                className={`w-full flex items-center ${isSidebarOpen ? 'space-x-3 px-6' : 'justify-center px-0'} py-4 transition-all duration-300 ${isActive ? 'bg-accent text-navy shadow-inner' : 'text-white/60 hover:text-white hover:bg-white/5'} rounded-xl`}
                            >
                                <Icon size={20} className={`${isActive ? 'animate-pulse' : ''} shrink-0`} />
                                {isSidebarOpen && <span className="font-bold text-sm tracking-wide">{item.label}</span>}
                            </button>
                        )
                    })}
                </nav>

                <div className="p-8 mt-auto flex flex-col space-y-4">
                    <button onClick={onLogout} className="flex items-center space-x-3 text-white/40 hover:text-danger hover:bg-danger/5 p-3 rounded-xl transition-all font-bold text-xs uppercase tracking-widest border border-transparent hover:border-danger/10">
                        <LogOut size={18} />
                        {isSidebarOpen && <span>Logout</span>}
                    </button>
                    {isSidebarOpen && (
                        <div className="pt-4 border-t border-white/5">
                            <p className="text-[9px] text-white/20 font-black uppercase tracking-widest text-center">Copyright EVONIX v1.0</p>
                        </div>
                    )}
                </div>
            </aside>
        </>
    )
}

export default Sidebar
