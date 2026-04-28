import React from 'react';
import {
    Plus, Layout, Grid, List, MoreHorizontal,
    Edit3, Trash2, Search, Filter, X, ChevronLeft, ChevronRight, AlertTriangle
} from 'lucide-react';
import { useCameraManagement } from '../../../hooks/camera/useCameraManagement';

const CameraManagement = () => {
    const {
        currentPage,
        setCurrentPage,
        isAddPopupOpen,
        openAddPopup,
        closeAddPopup,
        editCamera,
        setEditCamera,
        deleteCameraId,
        setDeleteCameraId,
        searchTerm,
        setSearchTerm,
        viewMode,
        setViewMode,
        loading,
        error,
        isDigestRetrying,
        newCamera,
        setNewCamera,
        paginatedCameras,
        filteredCameras,
        itemsPerPage,
        totalPages,
        safeCurrentPage,
        handleAddSubmit,
        handleEditSubmit,
        handleConfirmDelete,
    } = useCameraManagement();

    return (
        <div className="relative space-y-6 duration-500 md:space-y-8 animate-in fade-in">
            {loading && (
                <div className="p-4 text-center border bg-background border-navy/10 rounded-xl">
                    <p className="text-xs font-bold text-navy/60">
                        {isDigestRetrying ? 'Autentikasi digest diproses, mencoba ulang otomatis...' : 'Memuat data kamera...'}
                    </p>
                </div>
            )}

            {error && (
                <div className="p-4 text-center border rounded-xl bg-danger/10 border-danger/20">
                    <p className="text-xs font-bold text-danger">{error}</p>
                </div>
            )}
            <div className="flex flex-col items-start justify-between space-y-4 md:flex-row md:items-center md:space-y-0">
                <h2 className="text-lg font-black tracking-tight md:text-2xl text-navy">CAMERA MANAGEMENT</h2>
                <div className="flex items-center w-full space-x-2 md:w-auto md:space-x-4">
                    <div className="relative flex-1 w-full md:w-auto md:flex-none">
                        <Search size={16} className="absolute -translate-y-1/2 left-4 top-1/2 text-navy/30" />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Search camera..."
                            className="w-full py-3 pl-12 pr-4 text-xs font-bold transition-all bg-white border outline-none md:py-2 border-navy/5 rounded-xl focus:border-navy/20 md:w-64"
                        />
                    </div>
                    <button className="p-3 transition-colors bg-white border md:p-2 border-navy/5 rounded-xl text-navy/40 hover:text-navy shrink-0">
                        <Filter size={18} />
                    </button>
                </div>
            </div>

            <div className="overflow-hidden bg-white border shadow-sm rounded-3xl border-navy/5">
                <div className="flex flex-col items-start justify-between p-4 space-y-4 border-b md:p-8 border-navy/5 md:flex-row md:items-center md:space-y-0">
                    <button onClick={openAddPopup} className="flex items-center justify-center w-full px-6 py-3 space-x-2 transition-all shadow-lg btn-navy md:w-auto md:py-2 rounded-xl shadow-navy/10 hover:opacity-90 active:scale-95">
                        <Plus size={18} />
                        <span className="text-xs font-black tracking-widest uppercase">Add Device</span>
                    </button>
                    <div className="flex items-center justify-between w-full md:w-auto md:space-x-4">
                        <div className="flex justify-between w-full p-1 bg-navy/5 rounded-xl md:w-auto md:justify-start">
                            <button onClick={() => setViewMode('layout')} className={`p-1.5 rounded-lg transition-all ${viewMode === 'layout' ? 'bg-white text-navy shadow-sm' : 'text-navy/30 hover:text-navy'}`}><Layout size={16} /></button>
                            <button onClick={() => setViewMode('grid')} className={`p-1.5 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-white text-navy shadow-sm' : 'text-navy/30 hover:text-navy'}`}><Grid size={16} /></button>
                            <button onClick={() => setViewMode('list')} className={`p-1.5 rounded-lg transition-all ${viewMode === 'list' ? 'bg-white text-navy shadow-sm' : 'text-navy/30 hover:text-navy'}`}><List size={16} /></button>
                        </div>
                        <MoreHorizontal size={20} className="text-navy opacity-20" />
                    </div>
                </div>

                <div className="p-4 md:p-8">
                    <div className="overflow-x-auto min-h-[360px] animate-in fade-in duration-300 -mx-4 md:mx-0 px-4 md:px-0">
                        {viewMode === 'layout' && (
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="border-b-2 border-navy/5 text-[10px] font-black uppercase tracking-widest opacity-40">
                                        <th className="pb-4 pr-4"><input type="checkbox" className="w-3.5 h-3.5 rounded border-navy/20" /></th>
                                        <th className="pb-4 pr-4">Channel No.</th>
                                        <th className="pb-4 pr-4">Status</th>
                                        <th className="pb-4 pr-4">Record Status</th>
                                        <th className="pb-4 pr-4">Channel Name</th>
                                        <th className="pb-4 pr-4">Address</th>
                                        <th className="pb-4 pr-4">Registration No.</th>
                                        <th className="pb-4 pr-4">Port</th>
                                        <th className="pb-4 pr-4">Username</th>
                                        <th className="pb-4 pr-4">Password</th>
                                        <th className="pb-4 pr-4">Manufacturer</th>
                                        <th className="pb-4 pr-4">Model</th>
                                        <th className="pb-4 pr-4">SN</th>
                                        <th className="pb-4 pr-4">Remote CH No.</th>
                                        <th className="pb-4">Operation</th>
                                    </tr>
                                </thead>
                                <tbody className="text-xs font-bold divide-y divide-navy/5">
                                    {paginatedCameras.map((row) => (
                                        <tr key={row.id} className="transition-colors hover:bg-background">
                                            <td className="py-4 pr-4"><input type="checkbox" className="w-3.5 h-3.5 rounded border-navy/20" /></td>
                                            <td className="py-4 pr-4">{row.id}</td>
                                            <td className="py-4 pr-4">
                                                {row.status === 'online' ? (
                                                    <div className="flex items-center justify-center w-6 h-6 rounded-full bg-success/10">
                                                        <div className="w-3 h-3 rounded-full bg-success" />
                                                    </div>
                                                ) : (
                                                    <div className="relative flex items-center justify-center w-6 h-6 rounded-full cursor-pointer bg-warning/10 group">
                                                        <AlertTriangle className="w-4 h-4 text-warning" />
                                                        <div className="absolute bottom-full mb-2 w-max px-3 py-1.5 text-xs font-bold text-white bg-gray-800 rounded-md shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10">
                                                            {row.statusMessage || row.status || 'Unknown error'}
                                                            <div className="absolute w-0 h-0 -translate-x-1/2 border-t-4 left-1/2 top-full border-x-4 border-x-transparent border-t-gray-800" />
                                                        </div>
                                                    </div>
                                                )}
                                            </td>
                                            <td className="py-4 pr-4">
                                                <div className={`flex items-center justify-center w-6 h-6 rounded-full ${row.record ? 'bg-success/10' : 'bg-danger/10'}`}>
                                                    <div className={`w-3 h-3 rounded-full ${row.record ? 'bg-success' : 'bg-danger'}`} />
                                                </div>
                                            </td>
                                            <td className="py-4 pr-4">{row.channelName || '--'}</td>
                                            <td className="py-4 pr-4">{row.ip || '--'}</td>
                                            <td className="py-4 pr-4">{row.registrationNo || '--'}</td>
                                            <td className="py-4 pr-4">{row.port || '--'}</td>
                                            <td className="py-4 pr-4">{row.username || '--'}</td>
                                            <td className="py-4 pr-4">{row.passwordMasked || '--'}</td>
                                            <td className="py-4 pr-4">{row.manufacture || '--'}</td>
                                            <td className="py-4 pr-4">{row.model || '--'}</td>
                                            <td className="py-4 pr-4">{row.sn || '--'}</td>
                                            <td className="py-4 pr-4">{row.remoteChannelNo || '--'}</td>
                                            <td className="py-4">
                                                <div className="flex items-center gap-3">
                                                    <button onClick={() => setEditCamera(row)} className="text-[#1F6FFF] hover:underline">Edit</button>
                                                    <button onClick={() => setDeleteCameraId(row.id)} className="text-[#FF4D4F] hover:underline">Delete</button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}

                        {viewMode === 'grid' && (
                            <div className="grid grid-cols-1 gap-6 pt-2 md:grid-cols-2 lg:grid-cols-3">
                                {paginatedCameras.map((row) => (
                                    <div key={row.id} className="p-6 transition-all duration-300 bg-white border shadow-sm border-navy/5 rounded-3xl hover:shadow-xl hover:shadow-navy/5 group">
                                        <div className="flex items-start justify-between mb-4">
                                            <div className="flex items-center space-x-2 bg-background px-3 py-1.5 rounded-full border border-navy/5">
                                                <div className={`w-2 h-2 rounded-full ${String(row.status).toLowerCase() === 'online' ? 'bg-success animate-pulse' : 'bg-danger'} `} />
                                                <span className={`uppercase text-[9px] font-black tracking-widest ${String(row.status).toLowerCase() === 'online' ? 'text-success' : 'text-danger'}`}>{row.status}</span>
                                            </div>
                                            <span className="font-mono text-xs font-black text-navy/30">#{row.id.toString().padStart(3, '0')}</span>
                                        </div>
                                        <h4 className="mb-1 text-lg font-black tracking-tight text-navy">{row.deviceName || "-"}</h4>
                                        <p className="text-navy/50 text-[11px] mb-1">{row.channelName || row.name}</p>
                                        <p className="text-navy/40 font-mono text-[10px] mb-6">{row.ip} : {row.port || "-"}</p>
                                        <div className="flex items-center justify-between pt-4 border-t border-navy/5">
                                            <div className="flex space-x-2">
                                                <span className="px-2 py-1 bg-navy/5 rounded text-[9px] uppercase font-black tracking-widest text-navy/60">{row.manufacture}</span>
                                                {row.record && <span className="px-2 py-1 bg-success/10 rounded text-[9px] uppercase font-black tracking-widest text-success border border-success/10">REC</span>}
                                            </div>
                                            <div className="flex space-x-1 transition-opacity opacity-0 group-hover:opacity-100">
                                                <button onClick={() => setEditCamera(row)} className="p-2 transition-all text-navy hover:bg-navy/5 rounded-xl"><Edit3 size={14} /></button>
                                                <button onClick={() => setDeleteCameraId(row.id)} className="p-2 transition-all text-danger hover:bg-danger/5 rounded-xl"><Trash2 size={14} /></button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {viewMode === 'list' && (
                            <div className="pt-2 space-y-4">
                                {paginatedCameras.map((row) => (
                                    <div key={row.id} className="flex flex-col justify-between p-4 transition-all bg-white border md:flex-row md:items-center border-navy/5 rounded-2xl hover:shadow-lg hover:shadow-navy/5 hover:border-navy/10 group">
                                        <div className="flex items-center space-x-6">
                                            <div className="flex items-center justify-center w-12 h-12 font-mono text-xs font-black transition-colors border bg-background border-navy/5 rounded-xl text-navy/40 group-hover:bg-navy group-hover:text-white">
                                                {row.id.toString().padStart(3, '0')}
                                            </div>
                                            <div>
                                                <h4 className="text-sm font-black tracking-tight text-navy">{row.deviceName || "-"}</h4>
                                                <div className="flex items-center mt-1 space-x-4">
                                                    <span className="text-navy/50 text-[10px]">{row.channelName || row.name}</span>
                                                    <span className="text-navy/40 font-mono text-[10px]">{row.ip}</span>
                                                    <span className={`uppercase text-[8px] font-black tracking-widest px-2 py-0.5 rounded-full ${String(row.status).toLowerCase() === 'online' ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'}`}>{row.status}</span>
                                                    {row.record && <div className="flex items-center space-x-1"><span className="w-1.5 h-1.5 rounded-full bg-success"></span><span className="text-[8px] font-bold text-success/60 uppercase">Rec</span></div>}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center mt-4 space-x-6 md:mt-0">
                                            <span className="px-3 py-1.5 bg-background border border-navy/5 rounded-xl text-[9px] uppercase font-black tracking-widest text-navy/40">{row.manufacture}</span>
                                            <div className="flex space-x-2 transition-opacity translate-x-4 md:opacity-0 group-hover:opacity-100 group-hover:translate-x-0">
                                                <button onClick={() => setEditCamera(row)} className="p-2 transition-all text-navy hover:bg-navy/5 rounded-xl"><Edit3 size={16} /></button>
                                                <button onClick={() => setDeleteCameraId(row.id)} className="p-2 transition-all text-danger hover:bg-danger/5 rounded-xl"><Trash2 size={16} /></button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                        {filteredCameras.length === 0 && (
                            <div className="py-12 text-center">
                                <p className="text-sm font-bold text-navy/30">Tidak ada perangkat aktif yang ditemukan.</p>
                            </div>
                        )}
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="flex flex-col items-center justify-between pt-6 mt-8 space-y-4 border-t md:flex-row border-navy/5 md:space-y-0">
                            <span className="text-[10px] font-black uppercase tracking-widest text-navy/40">
                                Showing {(safeCurrentPage - 1) * itemsPerPage + 1} to {Math.min(safeCurrentPage * itemsPerPage, filteredCameras.length)} of {filteredCameras.length} devices
                            </span>
                            <div className="flex items-center space-x-2">
                                <button 
                                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                    disabled={safeCurrentPage === 1}
                                    className="p-2 transition-colors border bg-background border-navy/5 rounded-xl text-navy disabled:opacity-30 hover:bg-navy/5"
                                >
                                    <ChevronLeft size={16} />
                                </button>
                                <span className="px-4 py-2 text-xs font-black text-white shadow-lg bg-navy rounded-xl">
                                    {safeCurrentPage} / {totalPages}
                                </span>
                                <button 
                                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                    disabled={safeCurrentPage === totalPages}
                                    className="p-2 transition-colors border bg-background border-navy/5 rounded-xl text-navy disabled:opacity-30 hover:bg-navy/5"
                                >
                                    <ChevronRight size={16} />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Add Device Popup Modal */}
            {isAddPopupOpen && (
                <>
                    <div className="fixed inset-0 bg-navy/20 backdrop-blur-sm z-[100]" onClick={closeAddPopup} />
                    <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white w-full max-w-3xl rounded-[32px] shadow-2xl border border-navy/5 z-[101] overflow-hidden animate-in zoom-in-95 duration-300 max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between p-6 border-b border-navy/5 bg-background/50">
                            <div>
                                <h3 className="text-lg font-black tracking-tight uppercase text-navy">Add Device</h3>
                                <p className="text-[10px] font-bold text-navy/40 uppercase tracking-widest mt-1">/cgi-bin/configManager.cgi?action=setConfig</p>
                            </div>
                            <button onClick={closeAddPopup} className="p-2 transition-colors hover:bg-white rounded-xl text-navy/40 hover:text-navy">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-6">
                            <form onSubmit={handleAddSubmit} className="space-y-4">
                                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                    <div>
                                        <label className="block text-[10px] font-black uppercase tracking-widest text-navy/60 mb-2">Type</label>
                                        <div className="flex flex-wrap gap-4 px-4 py-3 border rounded-xl border-navy/5 bg-background">
                                            <label className="flex items-center gap-2 text-xs font-bold text-navy/70">
                                                <input
                                                    type="radio"
                                                    name="deviceType"
                                                    value="oneByOne"
                                                    checked={newCamera.type === 'oneByOne'}
                                                    onChange={e => setNewCamera({...newCamera, type: e.target.value})}
                                                />
                                                Add One by One
                                            </label>
                                            <label className="flex items-center gap-2 text-xs font-bold text-navy/70">
                                                <input
                                                    type="radio"
                                                    name="deviceType"
                                                    value="batchAdd"
                                                    checked={newCamera.type === 'batchAdd'}
                                                    onChange={e => setNewCamera({...newCamera, type: e.target.value})}
                                                />
                                                Batch Add
                                            </label>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black uppercase tracking-widest text-navy/60 mb-2">Channel No.</label>
                                        <div className="flex gap-3">
                                            <select
                                                value={newCamera.channelMode}
                                                onChange={e => setNewCamera({...newCamera, channelMode: e.target.value})}
                                                className="w-full px-4 py-3 text-xs font-bold transition-all border outline-none appearance-none bg-background border-navy/5 rounded-xl focus:border-navy/20"
                                            >
                                                <option value="auto">Auto Allocation</option>
                                                <option value="manual">Manual</option>
                                            </select>
                                            {newCamera.channelMode === 'manual' && (
                                                <input
                                                    type="number"
                                                    min="0"
                                                    value={newCamera.channelIndex}
                                                    onChange={e => setNewCamera({...newCamera, channelIndex: e.target.value})}
                                                    className="px-4 py-3 font-mono text-xs font-bold tracking-tight transition-all border outline-none w-28 bg-background border-navy/5 rounded-xl focus:border-navy/20"
                                                />
                                            )}
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-[10px] font-black uppercase tracking-widest text-navy/60 mb-2">Manufacturer</label>
                                        <select 
                                            value={newCamera.manufacturer} onChange={e => setNewCamera({...newCamera, manufacturer: e.target.value})}
                                            className="w-full px-4 py-3 text-xs font-bold transition-all border outline-none appearance-none bg-background border-navy/5 rounded-xl focus:border-navy/20"
                                        >
                                            <option value="Private">Private</option>
                                            <option value="Onvif">Onvif Generic</option>
                                            <option value="Dahua">Dahua</option>
                                            <option value="Hikvision">Hikvision</option>
                                            <option value="Axis">Axis</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-[10px] font-black uppercase tracking-widest text-navy/60 mb-2">IP Address</label>
                                        <input 
                                            type="text" required
                                            value={newCamera.ipAddress} onChange={e => setNewCamera({...newCamera, ipAddress: e.target.value})}
                                            className="w-full px-4 py-3 font-mono text-xs font-bold tracking-tight transition-all border outline-none bg-background border-navy/5 rounded-xl focus:border-navy/20"
                                            placeholder="192.168.1.108"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-[10px] font-black uppercase tracking-widest text-navy/60 mb-2">TCP Port</label>
                                        <input 
                                            type="text" required
                                            value={newCamera.tcpPort} onChange={e => setNewCamera({...newCamera, tcpPort: e.target.value})}
                                            className="w-full px-4 py-3 font-mono text-xs font-bold tracking-tight transition-all border outline-none bg-background border-navy/5 rounded-xl focus:border-navy/20"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-[10px] font-black uppercase tracking-widest text-navy/60 mb-2">Username</label>
                                        <input 
                                            type="text" required
                                            value={newCamera.username} onChange={e => setNewCamera({...newCamera, username: e.target.value})}
                                            className="w-full px-4 py-3 text-xs font-bold transition-all border outline-none bg-background border-navy/5 rounded-xl focus:border-navy/20"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-[10px] font-black uppercase tracking-widest text-navy/60 mb-2">Password</label>
                                        <input 
                                            type="password" required
                                            value={newCamera.password} onChange={e => setNewCamera({...newCamera, password: e.target.value})}
                                            className="w-full px-4 py-3 text-xs font-bold transition-all border outline-none bg-background border-navy/5 rounded-xl focus:border-navy/20"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-[10px] font-black uppercase tracking-widest text-navy/60 mb-2">Connection Type</label>
                                        <input
                                            type="text"
                                            value={newCamera.connectionType}
                                            onChange={e => setNewCamera({...newCamera, connectionType: e.target.value})}
                                            className="w-full px-4 py-3 text-xs font-bold transition-all border outline-none bg-background border-navy/5 rounded-xl focus:border-navy/20"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-[10px] font-black uppercase tracking-widest text-navy/60 mb-2">Cache Method</label>
                                        <input
                                            type="text"
                                            value={newCamera.cacheMethod}
                                            onChange={e => setNewCamera({...newCamera, cacheMethod: e.target.value})}
                                            className="w-full px-4 py-3 text-xs font-bold transition-all border outline-none bg-background border-navy/5 rounded-xl focus:border-navy/20"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-[10px] font-black uppercase tracking-widest text-navy/60 mb-2">Total Channels</label>
                                        <input
                                            type="number"
                                            min="1"
                                            value={newCamera.totalChannels}
                                            onChange={e => setNewCamera({...newCamera, totalChannels: e.target.value})}
                                            className="w-full px-4 py-3 font-mono text-xs font-bold tracking-tight transition-all border outline-none bg-background border-navy/5 rounded-xl focus:border-navy/20"
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-3 md:col-span-2">
                                        <div>
                                            <label className="block text-[10px] font-black uppercase tracking-widest text-navy/60 mb-2">Channel Start</label>
                                            <input
                                                type="number"
                                                min="1"
                                                value={newCamera.channelRangeStart}
                                                onChange={e => setNewCamera({...newCamera, channelRangeStart: e.target.value})}
                                                className="w-full px-4 py-3 font-mono text-xs font-bold tracking-tight transition-all border outline-none bg-background border-navy/5 rounded-xl focus:border-navy/20"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-black uppercase tracking-widest text-navy/60 mb-2">Channel End</label>
                                            <input
                                                type="number"
                                                min="1"
                                                value={newCamera.channelRangeEnd}
                                                onChange={e => setNewCamera({...newCamera, channelRangeEnd: e.target.value})}
                                                className="w-full px-4 py-3 font-mono text-xs font-bold tracking-tight transition-all border outline-none bg-background border-navy/5 rounded-xl focus:border-navy/20"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="pt-4 mt-4 border-t border-navy/5">
                                    <button type="submit" className="w-full py-4 text-xs font-black tracking-widest text-white uppercase transition-all bg-navy rounded-xl hover:bg-navy/90 hover:shadow-xl hover:shadow-navy/10 active:scale-95">
                                        Add Device
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </>
            )}

            {/* Edit Device Popup Modal */}
            {editCamera && (
                <>
                    <div className="fixed inset-0 bg-navy/20 backdrop-blur-sm z-[100]" onClick={() => setEditCamera(null)} />
                    <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white w-full max-w-md rounded-[32px] shadow-2xl border border-navy/5 z-[101] overflow-hidden animate-in zoom-in-95 duration-300">
                        <div className="flex items-center justify-between p-6 border-b border-navy/5 bg-background/50">
                            <div>
                                <h3 className="text-lg font-black tracking-tight uppercase text-navy">Edit Device Configuration</h3>
                                <p className="text-[10px] font-bold text-navy/40 uppercase tracking-widest mt-1">System Update Protocol</p>
                            </div>
                            <button onClick={() => setEditCamera(null)} className="p-2 transition-colors hover:bg-white rounded-xl text-navy/40 hover:text-navy">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-6">
                            <form onSubmit={handleEditSubmit} className="space-y-4">
                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-widest text-navy/60 mb-2">Device Name</label>
                                    <input 
                                        type="text" required
                                        value={editCamera.name} onChange={e => setEditCamera({...editCamera, name: e.target.value})}
                                        className="w-full px-4 py-3 text-xs font-bold transition-all border outline-none bg-background border-navy/5 rounded-xl focus:border-navy/20"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[10px] font-black uppercase tracking-widest text-navy/60 mb-2">IP Address</label>
                                        <input 
                                            type="text" required
                                            value={editCamera.ip} onChange={e => setEditCamera({...editCamera, ip: e.target.value})}
                                            className="w-full px-4 py-3 font-mono text-xs font-bold tracking-tight transition-all border outline-none bg-background border-navy/5 rounded-xl focus:border-navy/20"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black uppercase tracking-widest text-navy/60 mb-2">Manufacture</label>
                                        <select 
                                            value={editCamera.manufacture} onChange={e => setEditCamera({...editCamera, manufacture: e.target.value})}
                                            className="w-full px-4 py-3 text-xs font-bold transition-all border outline-none appearance-none bg-background border-navy/5 rounded-xl focus:border-navy/20"
                                        >
                                            <option value="Onvif">Onvif Generic</option>
                                            <option value="Dahua">Dahua</option>
                                            <option value="Hikvision">Hikvision</option>
                                            <option value="Axis">Axis</option>
                                        </select>
                                    </div>
                                </div>
                                <div className="flex items-center justify-between pt-4 pb-2">
                                    <label className="flex items-center space-x-3 cursor-pointer group">
                                        <input 
                                            type="checkbox" 
                                            checked={editCamera.status === 'online'} 
                                            onChange={e => setEditCamera({...editCamera, status: e.target.checked ? 'online' : 'offline'})}
                                            className="w-4 h-4 transition-all rounded text-success bg-background border-navy/10 focus:ring-success/20"
                                        />
                                        <span className="text-[10px] font-black uppercase tracking-widest text-navy/60 group-hover:text-navy transition-colors">Start Online</span>
                                    </label>
                                    <label className="flex items-center space-x-3 cursor-pointer group">
                                        <input 
                                            type="checkbox" 
                                            checked={editCamera.record} 
                                            onChange={e => setEditCamera({...editCamera, record: e.target.checked})}
                                            className="w-4 h-4 transition-all rounded text-navy bg-background border-navy/10 focus:ring-navy/20"
                                        />
                                        <span className="text-[10px] font-black uppercase tracking-widest text-navy/60 group-hover:text-navy transition-colors">Enable Recording</span>
                                    </label>
                                </div>
                                <div className="pt-4 mt-4 border-t border-navy/5">
                                    <button type="submit" className="w-full py-4 text-xs font-black tracking-widest text-white uppercase transition-all bg-navy rounded-xl hover:bg-navy/90 hover:shadow-xl hover:shadow-navy/10 active:scale-95">
                                        Update Device Registry
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </>
            )}

            {/* Delete Confirmation Popup */}
            {deleteCameraId !== null && (
                <>
                    <div className="fixed inset-0 bg-navy/20 backdrop-blur-sm z-[100]" onClick={() => setDeleteCameraId(null)} />
                    <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white w-full max-w-sm rounded-[32px] shadow-2xl border border-navy/5 z-[101] overflow-hidden animate-in zoom-in-95 duration-300">
                        <div className="p-8 space-y-4 text-center">
                            <div className="flex items-center justify-center w-16 h-16 mx-auto mb-4 rounded-full bg-danger/10">
                                <AlertTriangle size={32} className="text-danger" />
                            </div>
                            <h3 className="text-xl font-black tracking-tight uppercase text-navy">Hapus Perangkat?</h3>
                            <p className="text-xs font-medium text-navy/60">Data kamera akan dihapus secara permanen dari daftar jaringan. Operasi ini tidak dapat dibatalkan.</p>
                        </div>
                        <div className="flex items-center p-4 space-x-4 border-t bg-background/50 border-navy/5">
                            <button onClick={() => setDeleteCameraId(null)} className="flex-1 py-3 text-xs font-black tracking-widest uppercase transition-all shadow-sm text-navy/40 hover:bg-white hover:text-navy rounded-xl">
                                Batal
                            </button>
                            <button onClick={handleConfirmDelete} className="flex-1 py-3 text-xs font-black tracking-widest text-white uppercase transition-all bg-danger rounded-xl hover:bg-danger/90 hover:shadow-lg hover:shadow-danger/20 active:scale-95">
                                Hapus
                            </button>
                        </div>
                    </div>
                </>
            )}

        </div>
    );
};

export default CameraManagement;
