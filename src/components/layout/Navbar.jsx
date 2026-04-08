import React from 'react'
import { Bell, ChevronRight, Menu, User as UserIcon, X } from 'lucide-react'

const Navbar = ({
    isSidebarOpen,
    onToggleSidebar,
    title,
    currentTime,
    username,
    onToggleNotifications,
    onToggleAccountMenu,
    showNotifications,
    showAccountMenu,
}) => {
    return (
        <header className="h-20 bg-white flex items-center justify-between px-4 md:px-10 shrink-0 z-30 border-b border-navy/5 relative">
            <div className="flex items-center space-x-4 md:space-x-6">
                <button onClick={onToggleSidebar} className="p-2 hover:bg-background rounded-xl transition-colors">
                    {isSidebarOpen ? <Menu size={20} /> : <X size={20} />}
                </button>
                <div className="hidden md:flex items-center space-x-4">
                    <span className="text-xs font-black uppercase tracking-widest opacity-30">Site Manager</span>
                    <ChevronRight size={14} className="opacity-10" />
                    <span className="text-xs font-black uppercase tracking-widest text-navy underline decoration-accent decoration-4 underline-offset-4">
                        {title}
                    </span>
                </div>
            </div>

            <div className="flex items-center space-x-3 md:space-x-6">
                <div className="hidden lg:flex text-right flex-col items-end mr-4">
                    <span className="text-[10px] font-black opacity-30 uppercase tracking-tighter">System Pulse</span>
                    <span className="text-xs font-bold font-mono tracking-widest shadow-sm px-2 bg-background rounded">{currentTime}</span>
                </div>

                <button
                    onClick={onToggleNotifications}
                    className={`relative p-2.5 rounded-xl transition-all duration-300 ${showNotifications ? 'bg-navy text-white shadow-xl rotate-12' : 'bg-navy/5 text-navy hover:bg-navy/10'}`}
                >
                    <Bell size={20} />
                    <span className="absolute top-2 right-2 w-2 h-2 bg-danger rounded-full border-2 border-white animate-ping" />
                </button>

                <button
                    onClick={onToggleAccountMenu}
                    className={`flex items-center space-x-3 p-1.5 pr-4 rounded-2xl transition-all border ${showAccountMenu ? 'bg-navy border-navy text-white shadow-xl scale-105' : 'bg-background border-transparent hover:border-navy/10'}`}
                >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center border transition-all ${showAccountMenu ? 'bg-white/20 border-white/20 rotate-180' : 'bg-navy/10 border-navy/5'}`}>
                        <UserIcon size={16} className={showAccountMenu ? 'text-white' : 'text-navy text-opacity-40'} />
                    </div>
                    <span className="text-xs font-black tracking-tight uppercase">{username || 'Admin'}</span>
                </button>
            </div>
        </header>
    )
}

export default Navbar
