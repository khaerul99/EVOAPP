import React, { useState, useEffect } from 'react';
import { useNavigate, Outlet } from 'react-router-dom';
import { useStore } from '../../stores/useStore';
import { Sidebar, Navbar } from '../../components/layout';
const DashboardLayout = () => {
    const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth > 1024);

    return (
        <div className="relative flex h-screen overflow-hidden bg-background">
            {/* Backdrop Mobile: z-40 agar di bawah sidebar (z-50) tapi di atas navbar (z-40) */}
            {isSidebarOpen && (
                <div 
                    className="fixed inset-0 z-[45] bg-navy/20 backdrop-blur-md lg:hidden" 
                    onClick={() => setIsSidebarOpen(false)} 
                />
            )}

            <Sidebar isSidebarOpen={isSidebarOpen} onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} />

            {/* Margin dinamis mengikuti lebar sidebar di desktop */}
            <main className={`relative flex flex-col flex-1 min-w-0 transition-all duration-500 
                ${isSidebarOpen ? 'lg:ml-72' : 'lg:ml-24'}`}>
                
                <Navbar isSidebarOpen={isSidebarOpen} onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} />

                <div className="flex-1 p-6 overflow-y-auto">
                    <div className="max-w-[1600px] mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700">
                        <Outlet />
                    </div>
                </div>
            </main>
        </div>
    );
};
export default DashboardLayout;