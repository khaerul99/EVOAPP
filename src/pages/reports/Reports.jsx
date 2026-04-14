import React, { useEffect, useMemo, useState } from 'react';
import { BarChart2, Calendar, Download, RefreshCcw, ShieldAlert } from 'lucide-react';
import { cameraService } from '../../services/camera.service';
import { getSecurityLogs } from '../../lib/security-log';
import { exportAnalyticsWorkbook } from './report-export.util';

const RANGE_OPTIONS = [
    { id: '7d', label: '7 Hari', days: 7 },
    { id: '14d', label: '14 Hari', days: 14 },
    { id: '30d', label: '30 Hari', days: 30 },
];

function formatNumber(value) {
    return new Intl.NumberFormat('id-ID').format(Number(value) || 0);
}

function formatPercent(value) {
    const safeValue = Number.isFinite(Number(value)) ? Number(value) : 0;
    return `${safeValue.toFixed(1)}%`;
}

function dayKey(timestamp) {
    const date = new Date(timestamp);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function buildSeries(days) {
    const now = new Date();
    const series = [];

    for (let index = days - 1; index >= 0; index -= 1) {
        const date = new Date(now);
        date.setHours(0, 0, 0, 0);
        date.setDate(date.getDate() - index);

        series.push({
            key: dayKey(date.getTime()),
            label: date.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' }),
            value: 0,
            warnings: 0,
            successes: 0,
        });
    }

    return series;
}

function buildAnalytics(logs, cameras, days) {
    const since = Date.now() - days * 24 * 60 * 60 * 1000;
    const logsInRange = logs.filter((log) => Number(log.timestamp) >= since);
    const series = buildSeries(days);
    const seriesMap = new Map(series.map((item) => [item.key, item]));

    const severityCounts = {
        info: 0,
        warning: 0,
        error: 0,
    };

    const actionCounts = {};

    logsInRange.forEach((log) => {
        const timestamp = Number(log.timestamp) || Date.now();
        const key = dayKey(timestamp);
        const bucket = seriesMap.get(key);
        const level = String(log.level || 'info').toLowerCase();
        const action = String(log.action || 'event');

        if (bucket) {
            bucket.value += 1;
            if (level === 'warning' || level === 'error') {
                bucket.warnings += 1;
            }
            if (level === 'success' || action === 'login_success') {
                bucket.successes += 1;
            }
        }

        if (level === 'warning' || level === 'error' || level === 'info') {
            severityCounts[level] += 1;
        } else {
            severityCounts.info += 1;
        }

        actionCounts[action] = (actionCounts[action] || 0) + 1;
    });

    const totalLogs = logsInRange.length;
    const loginSuccess = actionCounts.login_success || 0;
    const loginFailed = actionCounts.login_failed || 0;
    const authAttempts = loginSuccess + loginFailed;
    const authSuccessRate = authAttempts > 0 ? (loginSuccess / authAttempts) * 100 : 100;

    const onlineCams = cameras.filter((camera) => String(camera.status).toLowerCase() === 'online').length;
    const offlineCams = Math.max(cameras.length - onlineCams, 0);
    const onlineRate = cameras.length > 0 ? (onlineCams / cameras.length) * 100 : 0;

    const topActions = Object.entries(actionCounts)
        .sort((left, right) => right[1] - left[1])
        .slice(0, 5)
        .map(([action, count]) => ({ action, count }));

    const latestEvents = [...logsInRange]
        .sort((left, right) => Number(right.timestamp || 0) - Number(left.timestamp || 0))
        .slice(0, 6);

    return {
        totalLogs,
        authSuccessRate,
        onlineCams,
        offlineCams,
        onlineRate,
        severityCounts,
        topActions,
        latestEvents,
        series,
    };
}

function buildTrendGeometry(series, maxValue) {
    const width = 760;
    const height = 220;
    const paddingX = 24;
    const paddingY = 20;
    const usableWidth = width - paddingX * 2;
    const usableHeight = height - paddingY * 2;
    const safeMax = Math.max(1, maxValue);
    const steps = Math.max(1, series.length - 1);

    const points = series.map((item, index) => {
        const x = paddingX + (usableWidth / steps) * index;
        const y = height - paddingY - (item.value / safeMax) * usableHeight;
        return { x, y };
    });

    const path = points
        .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
        .join(' ');

    const areaPath = points.length > 0
        ? `${path} L ${points[points.length - 1].x.toFixed(2)} ${(height - paddingY).toFixed(2)} L ${points[0].x.toFixed(2)} ${(height - paddingY).toFixed(2)} Z`
        : '';

    return {
        width,
        height,
        points,
        path,
        areaPath,
    };
}

const Reports = () => {
    const [rangeId, setRangeId] = useState('14d');
    const [cameras, setCameras] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const [logsVersion, setLogsVersion] = useState(0);

    const selectedRange = useMemo(() => {
        return RANGE_OPTIONS.find((option) => option.id === rangeId) || RANGE_OPTIONS[1];
    }, [rangeId]);

    const logs = useMemo(() => getSecurityLogs(), [logsVersion]);

    const analytics = useMemo(() => {
        return buildAnalytics(logs, cameras, selectedRange.days);
    }, [logs, cameras, selectedRange.days]);

    useEffect(() => {
        let cancelled = false;

        const loadCameras = async () => {
            setIsLoading(true);
            try {
                const rows = await cameraService.getCameraChannels();
                if (!cancelled) {
                    setCameras(Array.isArray(rows) ? rows : []);
                    setError('');
                }
            } catch {
                if (!cancelled) {
                    setCameras([]);
                    setError('Gagal mengambil data kamera untuk analytics.');
                }
            } finally {
                if (!cancelled) {
                    setIsLoading(false);
                }
            }
        };

        loadCameras();

        return () => {
            cancelled = true;
        };
    }, []);

    const handleRefresh = () => {
        setLogsVersion((value) => value + 1);
    };

    const handleExportWorkbook = () => {
        exportAnalyticsWorkbook({
            analytics,
            rangeLabel: selectedRange.label,
            rangeId: selectedRange.id,
            locale: 'id-ID',
        });
    };

    const maxTrend = Math.max(1, ...analytics.series.map((item) => item.value));
    const trendGeometry = useMemo(() => buildTrendGeometry(analytics.series, maxTrend), [analytics.series, maxTrend]);

    return (
        <div className="space-y-6 duration-500 animate-in fade-in">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <h2 className="text-2xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-navy via-accent to-navy">ANALYTICS</h2>
                    <p className="text-sm text-navy/45">Ringkasan performa keamanan dan operasional kamera.</p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    {RANGE_OPTIONS.map((option) => (
                        <button
                            key={option.id}
                            type="button"
                            onClick={() => setRangeId(option.id)}
                            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-[0.18em] border transition-all ${rangeId === option.id ? 'bg-navy text-white border-navy' : 'bg-white text-navy/60 border-navy/10 hover:text-navy'}`}
                        >
                            {option.label}
                        </button>
                    ))}

                    <button
                        type="button"
                        onClick={handleRefresh}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-navy/10 rounded-xl text-xs font-black uppercase tracking-[0.18em] text-navy/70 hover:text-navy"
                    >
                        <RefreshCcw size={14} />
                        Refresh
                    </button>

                    <button
                        type="button"
                        onClick={handleExportWorkbook}
                        className="inline-flex items-center gap-2 px-5 py-2 bg-navy text-white rounded-xl text-xs font-black uppercase tracking-[0.18em] shadow-sm hover:bg-navy/90"
                    >
                        <Download size={14} />
                        Export Excel
                    </button>
                </div>
            </div>

            {(isLoading || error) && (
                <div className={`p-4 border rounded-2xl ${error ? 'bg-danger/10 border-danger/20 text-danger' : 'bg-white border-navy/10 text-navy/60'}`}>
                    <p className="text-xs font-bold uppercase tracking-[0.18em]">
                        {isLoading ? 'Memuat data analytics...' : error}
                    </p>
                </div>
            )}

            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                <div className="p-5 bg-white border rounded-2xl border-navy/5 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-navy/35">Total Events</p>
                    <p className="mt-2 text-3xl font-black text-navy">{formatNumber(analytics.totalLogs)}</p>
                </div>

                <div className="p-5 bg-white border rounded-2xl border-navy/5 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-navy/35">Auth Success</p>
                    <p className="mt-2 text-3xl font-black text-navy">{formatPercent(analytics.authSuccessRate)}</p>
                </div>

                <div className="p-5 bg-white border rounded-2xl border-navy/5 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-navy/35">Online Camera</p>
                    <p className="mt-2 text-3xl font-black text-navy">{analytics.onlineCams}/{cameras.length}</p>
                </div>

                <div className="p-5 bg-white border rounded-2xl border-navy/5 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-navy/35">Warning + Error</p>
                    <p className="mt-2 text-3xl font-black text-danger">{formatNumber(analytics.severityCounts.warning + analytics.severityCounts.error)}</p>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                <div className="space-y-6 lg:col-span-2">
                    <div className="p-6 bg-white border shadow-sm rounded-2xl border-navy/5">
                        <div className="flex items-center justify-between mb-6">
                            <div>
                                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-navy/35">Activity Trend</p>
                                <h3 className="mt-1 text-xl font-black text-navy">Security Event per Hari</h3>
                            </div>
                            <div className="inline-flex items-center gap-2 px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] rounded-full bg-navy/[0.04] text-navy/50">
                                <Calendar size={14} />
                                {selectedRange.label}
                            </div>
                        </div>

                        <div className="p-4 border rounded-xl border-navy/5 bg-gradient-to-b from-navy/[0.03] to-transparent">
                            <div className="relative h-[220px]">
                                <div className="absolute inset-0 grid grid-rows-4 pointer-events-none">
                                    <div className="border-b border-dashed border-navy/10" />
                                    <div className="border-b border-dashed border-navy/10" />
                                    <div className="border-b border-dashed border-navy/10" />
                                    <div className="border-b border-dashed border-navy/10" />
                                </div>

                                <svg viewBox={`0 0 ${trendGeometry.width} ${trendGeometry.height}`} className="absolute inset-0 w-full h-full">
                                    <defs>
                                        <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor="rgba(26,59,92,0.30)" />
                                            <stop offset="100%" stopColor="rgba(26,59,92,0.02)" />
                                        </linearGradient>
                                    </defs>
                                    {trendGeometry.areaPath && (
                                        <path d={trendGeometry.areaPath} fill="url(#trendFill)" />
                                    )}
                                    {trendGeometry.path && (
                                        <path d={trendGeometry.path} fill="none" stroke="rgba(26,59,92,1)" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
                                    )}
                                    {trendGeometry.points.map((point, index) => (
                                        <circle key={`point-${analytics.series[index].key}`} cx={point.x} cy={point.y} r="4" fill="rgba(26,59,92,1)" />
                                    ))}
                                </svg>
                            </div>

                            <div className="grid grid-cols-7 gap-2 mt-3 text-center">
                                {analytics.series.map((item) => (
                                    <span key={item.key} className="text-[10px] font-semibold text-navy/35">
                                        {item.label}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="p-6 bg-white border shadow-sm rounded-2xl border-navy/5">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-black uppercase tracking-[0.18em] text-navy/50">Latest Security Events</h3>
                            <span className="text-xs font-bold text-navy/35">{analytics.latestEvents.length} events</span>
                        </div>

                        <div className="space-y-3">
                            {analytics.latestEvents.length > 0 ? analytics.latestEvents.map((event) => (
                                <div key={event.id} className="flex items-start justify-between p-3 border rounded-xl border-navy/5 bg-navy/[0.01]">
                                    <div>
                                        <p className="text-sm font-black text-navy">{event.action || 'event'}</p>
                                        <p className="text-xs text-navy/45">{event.message || '-'}</p>
                                    </div>
                                    <span className="text-[11px] font-bold text-navy/30">
                                        {new Date(event.timestamp).toLocaleString('id-ID')}
                                    </span>
                                </div>
                            )) : (
                                <div className="flex items-center justify-center p-6 text-center border rounded-xl border-navy/5 text-navy/40">
                                    <p className="text-xs font-bold uppercase tracking-[0.18em]">Belum ada event pada rentang ini</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="space-y-6">
                    <div className="p-6 text-white rounded-2xl bg-gradient-to-br from-navy to-[#102843] shadow-sm">
                        <BarChart2 size={28} className="mb-5 text-white/40" />
                        <h3 className="text-xl font-black">AI Insight</h3>
                        <p className="mt-2 text-xs leading-relaxed text-white/70">
                            Aktivitas tertinggi dalam {selectedRange.label.toLowerCase()} berasal dari kategori tindakan otentikasi dan pengaturan sistem.
                        </p>
                        <div className="grid grid-cols-2 gap-3 mt-6 text-center">
                            <div className="p-3 rounded-xl bg-white/10">
                                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/60">Online Rate</p>
                                <p className="mt-1 text-xl font-black">{formatPercent(analytics.onlineRate)}</p>
                            </div>
                            <div className="p-3 rounded-xl bg-white/10">
                                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/60">Offline</p>
                                <p className="mt-1 text-xl font-black">{analytics.offlineCams}</p>
                            </div>
                        </div>
                    </div>

                    <div className="p-6 bg-white border shadow-sm rounded-2xl border-navy/5">
                        <h3 className="text-sm font-black uppercase tracking-[0.18em] text-navy/50">Event Severity</h3>
                        <div className="mt-4 space-y-4">
                            {[
                                { key: 'info', label: 'Info', value: analytics.severityCounts.info, color: 'bg-navy' },
                                { key: 'warning', label: 'Warning', value: analytics.severityCounts.warning, color: 'bg-yellow-500' },
                                { key: 'error', label: 'Error', value: analytics.severityCounts.error, color: 'bg-danger' },
                            ].map((item) => {
                                const total = Math.max(1, analytics.totalLogs);
                                const width = (item.value / total) * 100;
                                return (
                                    <div key={item.key}>
                                        <div className="flex items-center justify-between mb-1 text-[11px] font-bold uppercase">
                                            <span className="text-navy/45">{item.label}</span>
                                            <span className="text-navy/60">{item.value}</span>
                                        </div>
                                        <div className="w-full h-2 overflow-hidden rounded-full bg-navy/5">
                                            <div className={`h-full ${item.color}`} style={{ width: `${Math.max(4, width)}%` }} />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div className="p-6 bg-white border shadow-sm rounded-2xl border-navy/5">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-black uppercase tracking-[0.18em] text-navy/50">Top Actions</h3>
                            <ShieldAlert size={16} className="text-navy/30" />
                        </div>
                        <div className="space-y-3">
                            {analytics.topActions.length > 0 ? analytics.topActions.map((action) => (
                                <div key={action.action} className="flex items-center justify-between p-3 rounded-xl bg-navy/[0.02]">
                                    <p className="text-xs font-black uppercase tracking-[0.16em] text-navy/60">{action.action}</p>
                                    <span className="text-sm font-black text-navy">{action.count}</span>
                                </div>
                            )) : (
                                <div className="p-4 text-center rounded-xl bg-navy/[0.02]">
                                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-navy/40">Belum ada data action</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Reports;
