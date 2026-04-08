import React from 'react';
import { FileText, Download, Filter, Calendar, BarChart2, PieChart, TrendingUp } from 'lucide-react';

const Reports = () => {
    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-black tracking-tight text-navy">SYSTEM REPORTS</h2>
                <div className="flex space-x-4">
                    <button className="flex items-center space-x-2 px-4 py-2 bg-white border border-navy/5 rounded-xl text-xs font-bold text-navy/60 hover:text-navy transition-all">
                        <Calendar size={16} />
                        <span>Last 30 Days</span>
                    </button>
                    <button className="flex items-center space-x-2 px-6 py-2 bg-navy text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-navy/10 hover:bg-navy/90 transition-all">
                        <Download size={16} />
                        <span>Export CSV</span>
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-8">
                    {/* Activity Chart Placeholder */}
                    <div className="bg-white p-8 rounded-3xl border border-navy/5 shadow-sm">
                        <div className="flex justify-between items-center mb-12">
                            <div>
                                <h3 className="text-sm font-black uppercase tracking-widest text-navy/40">Activity Trend</h3>
                                <p className="text-2xl font-black text-navy mt-1">Detection Density</p>
                            </div>
                            <div className="flex space-x-2">
                                <div className="flex items-center space-x-1">
                                    <div className="w-2 h-2 rounded-full bg-navy" />
                                    <span className="text-[9px] font-bold text-navy/40 uppercase">Persons</span>
                                </div>
                                <div className="flex items-center space-x-1">
                                    <div className="w-2 h-2 rounded-full bg-accent" />
                                    <span className="text-[9px] font-bold text-navy/40 uppercase">Vehicles</span>
                                </div>
                            </div>
                        </div>
                        <div className="h-64 w-full flex items-end justify-between px-4 pb-4 border-b border-navy/5">
                            {[
                                { p: 40, v: 20 }, { p: 60, v: 45 }, { p: 45, v: 30 }, { p: 90, v: 50 },
                                { p: 65, v: 40 }, { p: 80, v: 55 }, { p: 50, v: 25 }, { p: 70, v: 40 },
                                { p: 85, v: 60 }, { p: 60, v: 35 }, { p: 40, v: 20 }, { p: 55, v: 35 }
                            ].map((data, i) => (
                                <div key={i} className="flex flex-col items-center space-y-3 group w-full h-full">
                                    <div className="flex space-x-1.5 h-full items-end w-full justify-center">
                                        {/* Persons Bar */}
                                        <div className="w-full max-w-[12px] bg-navy/5 rounded-t-xl relative overflow-hidden h-full group-hover:bg-navy/10 transition-colors">
                                            <div
                                                className="absolute bottom-0 left-0 w-full bg-navy shadow-inner transition-all duration-1000 group-hover:brightness-110"
                                                style={{ height: `${data.p}%` }}
                                            />
                                        </div>
                                        {/* Vehicles Bar */}
                                        <div className="w-full max-w-[12px] bg-accent/10 rounded-t-xl relative overflow-hidden h-full group-hover:bg-accent/20 transition-colors">
                                            <div
                                                className="absolute bottom-0 left-0 w-full bg-accent shadow-inner transition-all duration-1000 group-hover:brightness-110"
                                                style={{ height: `${data.v}%` }}
                                            />
                                        </div>
                                    </div>
                                    <span className="text-[10px] font-black text-navy/20 uppercase group-hover:text-navy transition-colors">{['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][i]}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-8">
                        <div className="bg-white p-8 rounded-3xl border border-navy/5 shadow-sm">
                            <h3 className="text-[10px] font-black uppercase tracking-widest text-navy/40 mb-6">Total Detections</h3>
                            <div className="flex items-end space-x-4">
                                <span className="text-4xl font-black text-navy">12,842</span>
                                <span className="mb-1 text-xs font-bold text-success flex items-center">
                                    <TrendingUp size={14} className="mr-1" /> +12%
                                </span>
                            </div>
                        </div>
                        <div className="bg-white p-8 rounded-3xl border border-navy/5 shadow-sm">
                            <h3 className="text-[10px] font-black uppercase tracking-widest text-navy/40 mb-6">Average Matches</h3>
                            <div className="flex items-end space-x-4">
                                <span className="text-4xl font-black text-navy">94%</span>
                                <span className="mb-1 text-xs font-bold text-success flex items-center">
                                    <TrendingUp size={14} className="mr-1" /> +2.4%
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="space-y-8">
                    <div className="bg-navy p-8 rounded-3xl text-white shadow-xl shadow-navy/20">
                        <BarChart2 className="mb-8 opacity-40" size={32} />
                        <h3 className="text-xl font-black mb-2 tracking-tight">AI Insights</h3>
                        <p className="text-white/40 text-xs leading-relaxed font-medium">
                            The system has detected a 14% increase in traffic during the 09:00 - 11:00 window compared to last week.
                        </p>
                        <button className="mt-8 w-full py-3 bg-white/10 hover:bg-white/20 border border-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">
                            Full Analysis
                        </button>
                    </div>

                    <div className="bg-white p-8 rounded-3xl border border-navy/5 shadow-sm">
                        <h3 className="text-[10px] font-black uppercase tracking-widest text-navy/40 mb-8">System Health</h3>
                        <div className="space-y-6">
                            {[
                                { label: 'Storage Usage', val: 78, col: 'bg-navy' },
                                { label: 'CPU Load', val: 42, col: 'bg-success' },
                                { label: 'Memory', val: 56, col: 'bg-navy' }
                            ].map((s, i) => (
                                <div key={i}>
                                    <div className="flex justify-between text-[10px] font-bold uppercase mb-2">
                                        <span className="opacity-40">{s.label}</span>
                                        <span className="text-navy">{s.val}%</span>
                                    </div>
                                    <div className="h-1.5 w-full bg-navy/5 rounded-full overflow-hidden">
                                        <div className={`h-full ${s.col}`} style={{ width: `${s.val}%` }} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Reports;
