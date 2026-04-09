import React, { useMemo, useState } from 'react'
import { Check, RefreshCcw, Save, Settings, Shield, User } from 'lucide-react'
import { getSession } from '../../lib/session-helper'
import { addSecurityLog } from '../../lib/security-log'

const SETTINGS_KEY = 'evosecure_system_settings'

const DEFAULT_SETTINGS = {
    autoRefreshSeconds: 30,
    showSecurityBadge: true,
    compactCards: false,
}

function loadSettings() {
    try {
        const raw = localStorage.getItem(SETTINGS_KEY)
        if (!raw) {
            return DEFAULT_SETTINGS
        }
        return {
            ...DEFAULT_SETTINGS,
            ...JSON.parse(raw),
        }
    } catch {
        return DEFAULT_SETTINGS
    }
}

const SystemSettings = () => {
    const session = useMemo(() => getSession(), [])
    const [settings, setSettings] = useState(loadSettings)
    const [saved, setSaved] = useState(false)

    const serverHost = useMemo(() => {
        try {
            return new URL(import.meta.env.VITE_CAMERA_URL || '').host
        } catch {
            return '-'
        }
    }, [])

    const handleSave = () => {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
        addSecurityLog({
            level: 'info',
            action: 'settings_saved',
            message: 'System settings diperbarui.',
            username: session?.username || '-',
        })
        setSaved(true)
        setTimeout(() => setSaved(false), 1500)
    }

    const handleReset = () => {
        setSettings(DEFAULT_SETTINGS)
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(DEFAULT_SETTINGS))
        addSecurityLog({
            level: 'warning',
            action: 'settings_reset',
            message: 'System settings dikembalikan ke default.',
            username: session?.username || '-',
        })
        setSaved(true)
        setTimeout(() => setSaved(false), 1500)
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-black text-navy">System Settings</h1>
                    <p className="text-sm text-navy/50">Konfigurasi lokal untuk sesi pengguna saat ini.</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={handleReset}
                        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-bold border rounded-xl border-navy/10 text-navy/70 hover:bg-white"
                    >
                        <RefreshCcw size={16} />
                        Reset
                    </button>
                    <button
                        onClick={handleSave}
                        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-bold text-white rounded-xl bg-navy hover:bg-navy/90"
                    >
                        <Save size={16} />
                        Save
                    </button>
                </div>
            </div>

            {saved && (
                <div className="inline-flex items-center gap-2 px-3 py-2 text-sm font-bold rounded-xl bg-success/10 text-success">
                    <Check size={16} />
                    Settings berhasil disimpan.
                </div>
            )}

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <div className="p-5 bg-white border rounded-2xl border-navy/10">
                    <div className="flex items-center gap-2 mb-4">
                        <User size={18} className="text-navy/70" />
                        <h2 className="text-sm font-black tracking-wide uppercase text-navy/70">Account</h2>
                    </div>
                    <div className="space-y-3 text-sm">
                        <div className="flex justify-between">
                            <span className="text-navy/50">Username</span>
                            <span className="font-bold text-navy">{session?.username || '-'}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-navy/50">Server</span>
                            <span className="font-bold text-navy">{serverHost}</span>
                        </div>
                    </div>
                </div>

                <div className="p-5 bg-white border rounded-2xl border-navy/10">
                    <div className="flex items-center gap-2 mb-4">
                        <Settings size={18} className="text-navy/70" />
                        <h2 className="text-sm font-black tracking-wide uppercase text-navy/70">Preferences</h2>
                    </div>

                    <div className="space-y-4 text-sm">
                        <label className="block">
                            <span className="block mb-2 text-navy/60">Auto refresh interval (detik)</span>
                            <input
                                type="number"
                                min={5}
                                max={300}
                                value={settings.autoRefreshSeconds}
                                onChange={(event) =>
                                    setSettings((prev) => ({
                                        ...prev,
                                        autoRefreshSeconds: Number(event.target.value || 30),
                                    }))
                                }
                                className="w-full px-3 py-2 border rounded-lg border-navy/10 focus:outline-none focus:ring-2 focus:ring-navy/20"
                            />
                        </label>

                        <label className="flex items-center justify-between p-3 border rounded-xl border-navy/10">
                            <span className="text-navy/70">Tampilkan badge status keamanan</span>
                            <input
                                type="checkbox"
                                checked={settings.showSecurityBadge}
                                onChange={(event) =>
                                    setSettings((prev) => ({
                                        ...prev,
                                        showSecurityBadge: event.target.checked,
                                    }))
                                }
                            />
                        </label>

                        <label className="flex items-center justify-between p-3 border rounded-xl border-navy/10">
                            <span className="text-navy/70">Gunakan kartu dashboard compact</span>
                            <input
                                type="checkbox"
                                checked={settings.compactCards}
                                onChange={(event) =>
                                    setSettings((prev) => ({
                                        ...prev,
                                        compactCards: event.target.checked,
                                    }))
                                }
                            />
                        </label>
                    </div>
                </div>

                <div className="p-5 bg-white border rounded-2xl border-navy/10 lg:col-span-2">
                    <div className="flex items-center gap-2 mb-3">
                        <Shield size={18} className="text-navy/70" />
                        <h2 className="text-sm font-black tracking-wide uppercase text-navy/70">Auth Info</h2>
                    </div>
                    <p className="text-sm text-navy/60">
                        Login menggunakan Digest Authentication. Password tidak disimpan di local storage, sistem hanya
                        menyimpan hash secret untuk melanjutkan request yang membutuhkan autentikasi.
                    </p>
                </div>
            </div>
        </div>
    )
}

export default SystemSettings
