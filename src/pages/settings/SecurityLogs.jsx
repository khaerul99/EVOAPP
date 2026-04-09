import React, { useMemo, useState } from 'react'
import { AlertTriangle, RefreshCcw, Shield, Trash2 } from 'lucide-react'
import { clearSecurityLogs, getSecurityLogs } from '../../lib/security-log'

function formatTime(timestamp) {
    try {
        return new Date(timestamp).toLocaleString('id-ID')
    } catch {
        return '-'
    }
}

const SecurityLogs = () => {
    const [version, setVersion] = useState(0)
    const logs = useMemo(() => getSecurityLogs(), [version])

    const handleRefresh = () => setVersion((value) => value + 1)
    const handleClear = () => {
        clearSecurityLogs()
        setVersion((value) => value + 1)
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-black text-navy">Security Logs</h1>
                    <p className="text-sm text-navy/50">Riwayat aktivitas autentikasi dan sesi lokal.</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={handleRefresh}
                        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-bold border rounded-xl border-navy/10 text-navy/70 hover:bg-white"
                    >
                        <RefreshCcw size={16} />
                        Refresh
                    </button>
                    <button
                        onClick={handleClear}
                        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-bold text-danger border rounded-xl border-danger/20 bg-danger/10 hover:bg-danger/20"
                    >
                        <Trash2 size={16} />
                        Clear Logs
                    </button>
                </div>
            </div>

            <div className="overflow-hidden bg-white border rounded-2xl border-navy/10">
                <div className="grid grid-cols-12 px-5 py-3 text-[11px] font-black uppercase tracking-wider bg-navy/[0.03] text-navy/50">
                    <div className="col-span-3">Waktu</div>
                    <div className="col-span-2">Level</div>
                    <div className="col-span-3">Aksi</div>
                    <div className="col-span-4">Pesan</div>
                </div>

                {logs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center gap-2 px-6 py-10 text-navy/40">
                        <Shield size={24} />
                        <p className="text-sm font-semibold">Belum ada log keamanan.</p>
                    </div>
                ) : (
                    <div className="divide-y divide-navy/5">
                        {logs.map((log) => (
                            <div key={log.id} className="grid grid-cols-12 px-5 py-3 text-sm">
                                <div className="col-span-3 text-navy/60">{formatTime(log.timestamp)}</div>
                                <div className="col-span-2">
                                    <span
                                        className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-bold ${
                                            log.level === 'error'
                                                ? 'bg-danger/10 text-danger'
                                                : log.level === 'warning'
                                                    ? 'bg-yellow-100 text-yellow-700'
                                                    : 'bg-success/10 text-success'
                                        }`}
                                    >
                                        {log.level === 'error' && <AlertTriangle size={12} />}
                                        {String(log.level || 'info').toUpperCase()}
                                    </span>
                                </div>
                                <div className="col-span-3 font-semibold text-navy/80">{log.action}</div>
                                <div className="col-span-4 text-navy/70">{log.message}</div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}

export default SecurityLogs
