import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bell,
  User as UserIcon,
  Settings,
  Shield,
  LogOut,
  ChevronRight,
  Menu,
  X,
  Clock,
  Activity,
} from "lucide-react";

import { useClickOutside } from "../../hooks/common/useClickOutside";
import { getSession } from "../../lib/session-helper";
import { logout } from "../../stores/useStore";

const Navbar = ({ isSidebarOpen, onToggleSidebar }) => {
  const [currentTime, setCurrentTime] = useState(
    new Date().toLocaleTimeString("id-ID"),
  );
  const [scrolled, setScrolled] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  useEffect(() => {
    setCurrentUser(getSession());

    const timer = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString("id-ID"));
    }, 1000);

    const handleScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", handleScroll);

    return () => {
      clearInterval(timer);
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  const displayUsername = (currentUser?.username || "User").toUpperCase();
  const displayProfileName = currentUser?.username || "User";
  let displayProfileMeta = "SERVER";
  try {
    const cameraUrl = import.meta.env.VITE_CAMERA_URL || "";
    displayProfileMeta = cameraUrl
      ? new URL(cameraUrl).host.toUpperCase()
      : "SERVER";
  } catch {
    displayProfileMeta = "SERVER";
  }

  const notifRef = useRef();

  useClickOutside(notifRef, () => setShowNotifications(false));

  const pageTitle =
    location.pathname.split("/").pop()?.replace("-", " ") || "Dashboard";

  return (
    <header
      className={`sticky top-0 z-40 flex items-center justify-between h-20 px-6 transition-all duration-500 
            ${scrolled ? "bg-white/70 backdrop-blur-xl shadow-sm" : "bg-white"}`}
    >
      <div className="flex items-center gap-4">
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={onToggleSidebar}
          className="p-2.5 hover:bg-navy/5 text-navy rounded-2xl transition-colors flex items-center justify-center"
        >
          <div className="hidden lg:block">
            {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </div>
          <div className="lg:hidden">
            <Menu size={20} />
          </div>
        </motion.button>

        <div className="flex flex-col">
          <div className="flex items-center gap-2 text-[10px] font-bold tracking-[0.2em] text-navy/30 uppercase">
            <span>EVOSECU HUB</span>
            <ChevronRight size={10} />
            <span className="text-accent">LIVE</span>
          </div>
          <h2 className="text-lg font-black tracking-tight capitalize text-navy">
            {pageTitle}
          </h2>
        </div>
      </div>

      <div className="flex items-center gap-3 md:gap-6">
        {/* System Pulse - Digital Style */}
        <div className="hidden lg:flex items-center gap-4 px-4 py-2 bg-navy/[0.03] border border-navy/5 rounded-2xl">
          <div className="flex flex-col text-right">
            <span className="text-[9px] font-black text-navy/40 uppercase leading-none">
              Status
            </span>
            <span className="text-[10px] font-bold text-success flex items-center gap-1 leading-none mt-1">
              <span className="w-1.5 h-1.5 bg-success rounded-full animate-pulse" />
              SECURE
            </span>
          </div>
          <div className="w-[1px] h-6 bg-navy/10" />
          <div className="flex items-center gap-2 font-mono text-sm font-black text-navy">
            <Clock size={14} className="text-navy/30" />
            {currentTime}
          </div>
        </div>

        {/* Notifications */}
        <div className="relative">
          <motion.button
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowNotifications(!showNotifications)}
            className={`p-3 rounded-2xl transition-all relative ${showNotifications ? "bg-navy text-white" : "bg-navy/5 text-navy hover:bg-navy/10"}`}
            ref={notifRef}
          >
            <Bell size={20} />
            <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-danger rounded-full border-2 border-white" />
          </motion.button>

          <AnimatePresence>
            {showNotifications && (
              <motion.div
                initial={{ opacity: 0, y: 15, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 15, scale: 0.95 }}
                className="absolute right-0 mt-4 w-80 bg-white border border-navy/5 shadow-2xl rounded-[2rem] overflow-hidden"
              >
                <div className="flex items-center justify-between p-5 text-white bg-navy">
                  <span className="text-xs font-black tracking-widest uppercase">
                    Incidents
                  </span>
                  <Activity size={16} className="text-accent" />
                </div>
                <div className="p-2 overflow-y-auto max-h-80">
                  {[1, 2].map((i) => (
                    <div
                      key={i}
                      className="p-4 transition-colors cursor-pointer hover:bg-navy/5 rounded-2xl group"
                    >
                      <p className="text-[10px] font-bold text-navy/40 uppercase mb-1 group-hover:text-navy">
                        Cams 0{i} • 14:20
                      </p>
                      <p className="text-xs font-bold transition-colors text-navy group-hover:text-navy">
                        Unauthorized access detected in North Perimeter
                      </p>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="relative">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => {
              setShowAccountMenu(!showAccountMenu);
              setShowNotifications(false);
            }}
            className={`flex items-center gap-3 p-1.5 pr-4 rounded-2xl transition-all border 
            ${
              showAccountMenu
                ? "bg-navy border-navy text-white shadow-xl"
                : "bg-gray-50 border-transparent hover:border-navy/10 text-navy"
            }`}
          >
            <div
              className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all 
            ${showAccountMenu ? "bg-white/20" : "bg-navy/5"}`}
            >
              <UserIcon size={16} />
            </div>
            <div className="hidden md:flex md:flex-col md:items-start">
              <span className="text-[10px] font-black uppercase tracking-wider opacity-50">
                Role: Admin
              </span>
              <span className="text-xs font-black tracking-tight uppercase">
                {displayUsername}
              </span>
            </div>
          </motion.button>

          <AnimatePresence>
            {showAccountMenu && (
              <>
                {/* Invisible Overlay: Menutup dropdown saat klik di luar area */}
                <div
                  className="fixed inset-0 z-[60] bg-transparent"
                  onClick={() => setShowAccountMenu(false)}
                />

                {/* Dropdown Card */}
                <motion.div
                  initial={{ opacity: 0, y: 15, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 15, scale: 0.95 }}
                  transition={{ duration: 0.2, ease: "easeOut" }}
                  className="absolute right-0 z-[70] mt-4 w-64 bg-white border border-gray-100 shadow-[0_20px_50px_rgba(0,0,0,0.2)] rounded-[2rem] overflow-hidden"
                >
                  {/* Header Profil */}
                  <div className="p-6 border-b border-gray-100 bg-gray-50">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center w-10 h-10 text-white rounded-full bg-navy">
                        <Shield size={20} />
                      </div>
                      <div>
                        <p className="text-sm font-black leading-none text-navy">
                          {displayProfileName}
                        </p>
                        <p className="text-[10px] font-bold text-gray-400 mt-1 uppercase tracking-tighter">
                          {displayProfileMeta}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Menu List */}
                  <div className="p-3 space-y-1 bg-white">
                    <button
                      onClick={() => {
                        setShowAccountMenu(false);
                        navigate("/dashboard/system-settings");
                      }}
                      className="flex items-center w-full gap-3 px-4 py-3 text-xs font-bold transition-all text-navy/60 hover:text-navy hover:bg-gray-50 rounded-2xl"
                    >
                      <Settings size={16} />
                      <span>System Settings</span>
                    </button>
                    <button
                      onClick={() => {
                        setShowAccountMenu(false);
                        navigate("/dashboard/security-logs");
                      }}
                      className="flex items-center w-full gap-3 px-4 py-3 text-xs font-bold transition-all text-navy/60 hover:text-navy hover:bg-gray-50 rounded-2xl"
                    >
                      <Shield size={16} />
                      <span>Security Logs</span>
                    </button>
                  </div>

                  {/* Footer / Logout */}
                  <div className="p-3 bg-gray-50/50">
                    <button
                      onClick={() => {
                        setShowAccountMenu(false);
                        handleLogout();
                      }}
                      className="flex items-center justify-center w-full py-4 gap-3 bg-danger/10 hover:bg-danger text-danger hover:text-white rounded-2xl transition-all text-[10px] font-black uppercase tracking-widest"
                    >
                      <LogOut size={16} />
                      <span>LogOut</span>
                    </button>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
