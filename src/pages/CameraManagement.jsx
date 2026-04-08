import React, { useState, useEffect } from 'react';
import {
    Plus, Layout, Grid, List, MoreHorizontal,
    Edit3, Trash2, Search, Filter, X, ChevronLeft, ChevronRight, AlertTriangle
} from 'lucide-react';

const INITIAL_CAMERAS = Array.from({ length: 15 }, (_, i) => ({
    id: i + 1,
    name: `Camera Zone ${i + 1}`,
    ip: `192.168.1.${100 + i}`,
    status: i % 4 === 0 ? 'offline' : 'online',
    record: i % 4 !== 0,
    manufacture: ['Onvif', 'Dahua', 'Hikvision'][i % 3]
}));

const CameraManagement = () => {
    const [cameras, setCameras] = useState(() => {
        const saved = localStorage.getItem('evosecure_cameras');
        try {
            return saved ? JSON.parse(saved) : INITIAL_CAMERAS;
        } catch {
            return INITIAL_CAMERAS;
        }
    });

    useEffect(() => {
        localStorage.setItem('evosecure_cameras', JSON.stringify(cameras));
    }, [cameras]);

    const [currentPage, setCurrentPage] = useState(1);
    
    const [isAddPopupOpen, setIsAddPopupOpen] = useState(false);
    const [editCamera, setEditCamera] = useState(null);
    const [deleteCameraId, setDeleteCameraId] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [viewMode, setViewMode] = useState('layout');

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm]);
    
    const [newCamera, setNewCamera] = useState({
        name: '',
        ip: '',
        status: 'online',
        record: true,
        manufacture: 'Onvif'
    });

    const itemsPerPage = 5;
    const filteredCameras = cameras.filter(c => 
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        c.ip.includes(searchTerm) || 
        c.manufacture.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const totalPages = Math.ceil(filteredCameras.length / itemsPerPage) || 1;
    const safeCurrentPage = Math.min(currentPage, totalPages);
    const paginatedCameras = filteredCameras.slice((safeCurrentPage - 1) * itemsPerPage, safeCurrentPage * itemsPerPage);

    const handleAddSubmit = (e) => {
        e.preventDefault();
        const id = cameras.length > 0 ? Math.max(...cameras.map(c => c.id)) + 1 : 1;
        const addedCamera = { id, ...newCamera };
        setCameras([...cameras, addedCamera]);
        setIsAddPopupOpen(false);
        setNewCamera({ name: '', ip: '', status: 'online', record: true, manufacture: 'Onvif' });
        
        // Navigate to the last page where the new item is added
        const updatedTotalLength = cameras.length + 1;
        const newTotalPages = Math.ceil(updatedTotalLength / itemsPerPage);
        setCurrentPage(newTotalPages);
    };

    const handleEditSubmit = (e) => {
        e.preventDefault();
        setCameras(cameras.map(c => c.id === editCamera.id ? editCamera : c));
        setEditCamera(null);
    };

    const handleConfirmDelete = () => {
        setCameras(cameras.filter(c => c.id !== deleteCameraId));
        setDeleteCameraId(null);
    };

    return (
        <div className="space-y-6 md:space-y-8 animate-in fade-in duration-500 relative">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center space-y-4 md:space-y-0">
                <h2 className="text-lg md:text-2xl font-black tracking-tight text-navy">CAMERA MANAGEMENT</h2>
                <div className="flex w-full md:w-auto items-center space-x-2 md:space-x-4">
                    <div className="relative w-full md:w-auto flex-1 md:flex-none">
                        <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-navy/30" />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Search camera..."
                            className="pl-12 pr-4 py-3 md:py-2 bg-white border border-navy/5 rounded-xl text-xs font-bold outline-none focus:border-navy/20 transition-all w-full md:w-64"
                        />
                    </div>
                    <button className="p-3 md:p-2 bg-white border border-navy/5 rounded-xl text-navy/40 hover:text-navy transition-colors shrink-0">
                        <Filter size={18} />
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-3xl shadow-sm border border-navy/5 overflow-hidden">
                <div className="p-4 md:p-8 border-b border-navy/5 flex flex-col md:flex-row justify-between items-start md:items-center space-y-4 md:space-y-0">
                    <button onClick={() => setIsAddPopupOpen(true)} className="btn-navy w-full md:w-auto flex justify-center items-center space-x-2 py-3 md:py-2 px-6 rounded-xl shadow-lg shadow-navy/10 hover:opacity-90 transition-all active:scale-95">
                        <Plus size={18} />
                        <span className="text-xs font-black uppercase tracking-widest">Add Device</span>
                    </button>
                    <div className="flex items-center justify-between w-full md:w-auto md:space-x-4">
                        <div className="flex bg-navy/5 p-1 rounded-xl w-full md:w-auto justify-between md:justify-start">
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
                                        <th className="pb-4 pr-6">ID</th>
                                        <th className="pb-4">Status</th>
                                        <th className="pb-4">Record</th>
                                        <th className="pb-4">Device Name</th>
                                        <th className="pb-4">IP Address</th>
                                        <th className="pb-4 text-center">Port</th>
                                        <th className="pb-4">Manufacture</th>
                                        <th className="pb-4 text-right">Operation</th>
                                    </tr>
                                </thead>
                                <tbody className="text-xs font-bold divide-y divide-navy/5">
                                    {paginatedCameras.map((row) => (
                                        <tr key={row.id} className="group hover:bg-background transition-colors">
                                            <td className="py-5 pr-6 text-navy/30 font-mono">#{row.id.toString().padStart(3, '0')}</td>
                                            <td className="py-5">
                                                <div className="flex items-center space-x-2">
                                                    <div className={`w-2 h-2 rounded-full ${row.status === 'online' ? 'bg-success shadow-[0_0_8px_rgba(39,174,96,0.5)]' : 'bg-danger'} `} />
                                                    <span className={`uppercase text-[9px] font-black ${row.status === 'online' ? 'text-success' : 'text-danger'}`}>{row.status}</span>
                                                </div>
                                            </td>
                                            <td className="py-5">
                                                <div className={`w-2 h-2 rounded-full ${row.record ? 'bg-success' : 'bg-danger/20'} `} />
                                            </td>
                                            <td className="py-5 text-navy">{row.name}</td>
                                            <td className="py-5 font-mono text-navy/60">{row.ip}</td>
                                            <td className="py-5 text-center text-navy/60">8000</td>
                                            <td className="py-5">
                                                <span className="px-2 py-1 bg-navy/5 rounded text-[10px] uppercase">{row.manufacture}</span>
                                            </td>
                                            <td className="py-5 text-right">
                                                <div className="flex items-center justify-end space-x-4">
                                                    <button onClick={() => setEditCamera(row)} className="p-2 text-navy/30 hover:text-navy hover:bg-white rounded-lg transition-all border border-transparent hover:border-navy/5">
                                                        <Edit3 size={14} />
                                                    </button>
                                                    <button onClick={() => setDeleteCameraId(row.id)} className="p-2 text-danger/40 hover:text-danger hover:bg-danger/5 rounded-lg transition-all border border-transparent hover:border-danger/10">
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}

                        {viewMode === 'grid' && (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-2">
                                {paginatedCameras.map((row) => (
                                    <div key={row.id} className="bg-white border border-navy/5 p-6 rounded-3xl shadow-sm hover:shadow-xl hover:shadow-navy/5 transition-all duration-300 group">
                                        <div className="flex justify-between items-start mb-4">
                                            <div className="flex items-center space-x-2 bg-background px-3 py-1.5 rounded-full border border-navy/5">
                                                <div className={`w-2 h-2 rounded-full ${row.status === 'online' ? 'bg-success animate-pulse' : 'bg-danger'} `} />
                                                <span className={`uppercase text-[9px] font-black tracking-widest ${row.status === 'online' ? 'text-success' : 'text-danger'}`}>{row.status}</span>
                                            </div>
                                            <span className="text-navy/30 font-mono text-xs font-black">#{row.id.toString().padStart(3, '0')}</span>
                                        </div>
                                        <h4 className="text-lg font-black text-navy mb-1 tracking-tight">{row.name}</h4>
                                        <p className="text-navy/40 font-mono text-[10px] mb-6">{row.ip} : 8000</p>
                                        <div className="flex justify-between items-center pt-4 border-t border-navy/5">
                                            <div className="flex space-x-2">
                                                <span className="px-2 py-1 bg-navy/5 rounded text-[9px] uppercase font-black tracking-widest text-navy/60">{row.manufacture}</span>
                                                {row.record && <span className="px-2 py-1 bg-success/10 rounded text-[9px] uppercase font-black tracking-widest text-success border border-success/10">REC</span>}
                                            </div>
                                            <div className="flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button onClick={() => setEditCamera(row)} className="p-2 text-navy hover:bg-navy/5 rounded-xl transition-all"><Edit3 size={14} /></button>
                                                <button onClick={() => setDeleteCameraId(row.id)} className="p-2 text-danger hover:bg-danger/5 rounded-xl transition-all"><Trash2 size={14} /></button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {viewMode === 'list' && (
                            <div className="space-y-4 pt-2">
                                {paginatedCameras.map((row) => (
                                    <div key={row.id} className="flex flex-col md:flex-row md:items-center justify-between p-4 bg-white border border-navy/5 rounded-2xl hover:shadow-lg hover:shadow-navy/5 hover:border-navy/10 transition-all group">
                                        <div className="flex items-center space-x-6">
                                            <div className="w-12 h-12 bg-background border border-navy/5 rounded-xl flex items-center justify-center font-mono text-xs font-black text-navy/40 group-hover:bg-navy group-hover:text-white transition-colors">
                                                {row.id.toString().padStart(3, '0')}
                                            </div>
                                            <div>
                                                <h4 className="text-sm font-black text-navy tracking-tight">{row.name}</h4>
                                                <div className="flex items-center space-x-4 mt-1">
                                                    <span className="text-navy/40 font-mono text-[10px]">{row.ip}</span>
                                                    <span className={`uppercase text-[8px] font-black tracking-widest px-2 py-0.5 rounded-full ${row.status === 'online' ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'}`}>{row.status}</span>
                                                    {row.record && <div className="flex items-center space-x-1"><span className="w-1.5 h-1.5 rounded-full bg-success"></span><span className="text-[8px] font-bold text-success/60 uppercase">Rec</span></div>}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center space-x-6 mt-4 md:mt-0">
                                            <span className="px-3 py-1.5 bg-background border border-navy/5 rounded-xl text-[9px] uppercase font-black tracking-widest text-navy/40">{row.manufacture}</span>
                                            <div className="flex space-x-2 md:opacity-0 group-hover:opacity-100 transition-opacity translate-x-4 group-hover:translate-x-0">
                                                <button onClick={() => setEditCamera(row)} className="p-2 text-navy hover:bg-navy/5 rounded-xl transition-all"><Edit3 size={16} /></button>
                                                <button onClick={() => setDeleteCameraId(row.id)} className="p-2 text-danger hover:bg-danger/5 rounded-xl transition-all"><Trash2 size={16} /></button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                        {filteredCameras.length === 0 && (
                            <div className="py-12 text-center">
                                <p className="text-navy/30 font-bold text-sm">Tidak ada data perangkat CCTV yang terdaftar atau ditemukan.</p>
                            </div>
                        )}
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="flex flex-col md:flex-row items-center justify-between mt-8 border-t border-navy/5 pt-6 space-y-4 md:space-y-0">
                            <span className="text-[10px] font-black uppercase tracking-widest text-navy/40">
                                Showing {(safeCurrentPage - 1) * itemsPerPage + 1} to {Math.min(safeCurrentPage * itemsPerPage, filteredCameras.length)} of {filteredCameras.length} devices
                            </span>
                            <div className="flex items-center space-x-2">
                                <button 
                                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                    disabled={safeCurrentPage === 1}
                                    className="p-2 bg-background border border-navy/5 rounded-xl text-navy disabled:opacity-30 hover:bg-navy/5 transition-colors"
                                >
                                    <ChevronLeft size={16} />
                                </button>
                                <span className="px-4 py-2 bg-navy text-white text-xs font-black rounded-xl shadow-lg">
                                    {safeCurrentPage} / {totalPages}
                                </span>
                                <button 
                                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                    disabled={safeCurrentPage === totalPages}
                                    className="p-2 bg-background border border-navy/5 rounded-xl text-navy disabled:opacity-30 hover:bg-navy/5 transition-colors"
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
                    <div className="fixed inset-0 bg-navy/20 backdrop-blur-sm z-[100]" onClick={() => setIsAddPopupOpen(false)} />
                    <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white w-full max-w-md rounded-[32px] shadow-2xl border border-navy/5 z-[101] overflow-hidden animate-in zoom-in-95 duration-300">
                        <div className="p-6 border-b border-navy/5 flex justify-between items-center bg-background/50">
                            <div>
                                <h3 className="text-lg font-black text-navy uppercase tracking-tight">Register New Device</h3>
                                <p className="text-[10px] font-bold text-navy/40 uppercase tracking-widest mt-1">System Enrollment Protocol</p>
                            </div>
                            <button onClick={() => setIsAddPopupOpen(false)} className="p-2 hover:bg-white rounded-xl transition-colors text-navy/40 hover:text-navy">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-6">
                            <form onSubmit={handleAddSubmit} className="space-y-4">
                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-widest text-navy/60 mb-2">Device Name</label>
                                    <input 
                                        type="text" required
                                        value={newCamera.name} onChange={e => setNewCamera({...newCamera, name: e.target.value})}
                                        className="w-full px-4 py-3 bg-background border border-navy/5 rounded-xl text-xs font-bold outline-none focus:border-navy/20 transition-all"
                                        placeholder="e.g. Lobby Entrance 2"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[10px] font-black uppercase tracking-widest text-navy/60 mb-2">IP Address</label>
                                        <input 
                                            type="text" required
                                            value={newCamera.ip} onChange={e => setNewCamera({...newCamera, ip: e.target.value})}
                                            className="w-full px-4 py-3 bg-background border border-navy/5 rounded-xl text-xs font-bold font-mono outline-none focus:border-navy/20 transition-all tracking-tight"
                                            placeholder="192.168.x.x"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black uppercase tracking-widest text-navy/60 mb-2">Manufacture</label>
                                        <select 
                                            value={newCamera.manufacture} onChange={e => setNewCamera({...newCamera, manufacture: e.target.value})}
                                            className="w-full px-4 py-3 bg-background border border-navy/5 rounded-xl text-xs font-bold outline-none focus:border-navy/20 transition-all appearance-none"
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
                                            checked={newCamera.status === 'online'} 
                                            onChange={e => setNewCamera({...newCamera, status: e.target.checked ? 'online' : 'offline'})}
                                            className="w-4 h-4 rounded text-success bg-background border-navy/10 focus:ring-success/20 transition-all"
                                        />
                                        <span className="text-[10px] font-black uppercase tracking-widest text-navy/60 group-hover:text-navy transition-colors">Start Online</span>
                                    </label>
                                    <label className="flex items-center space-x-3 cursor-pointer group">
                                        <input 
                                            type="checkbox" 
                                            checked={newCamera.record} 
                                            onChange={e => setNewCamera({...newCamera, record: e.target.checked})}
                                            className="w-4 h-4 rounded text-navy bg-background border-navy/10 focus:ring-navy/20 transition-all"
                                        />
                                        <span className="text-[10px] font-black uppercase tracking-widest text-navy/60 group-hover:text-navy transition-colors">Enable Recording</span>
                                    </label>
                                </div>
                                <div className="pt-4 mt-4 border-t border-navy/5">
                                    <button type="submit" className="w-full py-4 bg-navy text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-navy/90 hover:shadow-xl hover:shadow-navy/10 transition-all active:scale-95">
                                        Enroll Device to Network
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
                        <div className="p-6 border-b border-navy/5 flex justify-between items-center bg-background/50">
                            <div>
                                <h3 className="text-lg font-black text-navy uppercase tracking-tight">Edit Device Configuration</h3>
                                <p className="text-[10px] font-bold text-navy/40 uppercase tracking-widest mt-1">System Update Protocol</p>
                            </div>
                            <button onClick={() => setEditCamera(null)} className="p-2 hover:bg-white rounded-xl transition-colors text-navy/40 hover:text-navy">
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
                                        className="w-full px-4 py-3 bg-background border border-navy/5 rounded-xl text-xs font-bold outline-none focus:border-navy/20 transition-all"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[10px] font-black uppercase tracking-widest text-navy/60 mb-2">IP Address</label>
                                        <input 
                                            type="text" required
                                            value={editCamera.ip} onChange={e => setEditCamera({...editCamera, ip: e.target.value})}
                                            className="w-full px-4 py-3 bg-background border border-navy/5 rounded-xl text-xs font-bold font-mono outline-none focus:border-navy/20 transition-all tracking-tight"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black uppercase tracking-widest text-navy/60 mb-2">Manufacture</label>
                                        <select 
                                            value={editCamera.manufacture} onChange={e => setEditCamera({...editCamera, manufacture: e.target.value})}
                                            className="w-full px-4 py-3 bg-background border border-navy/5 rounded-xl text-xs font-bold outline-none focus:border-navy/20 transition-all appearance-none"
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
                                            className="w-4 h-4 rounded text-success bg-background border-navy/10 focus:ring-success/20 transition-all"
                                        />
                                        <span className="text-[10px] font-black uppercase tracking-widest text-navy/60 group-hover:text-navy transition-colors">Start Online</span>
                                    </label>
                                    <label className="flex items-center space-x-3 cursor-pointer group">
                                        <input 
                                            type="checkbox" 
                                            checked={editCamera.record} 
                                            onChange={e => setEditCamera({...editCamera, record: e.target.checked})}
                                            className="w-4 h-4 rounded text-navy bg-background border-navy/10 focus:ring-navy/20 transition-all"
                                        />
                                        <span className="text-[10px] font-black uppercase tracking-widest text-navy/60 group-hover:text-navy transition-colors">Enable Recording</span>
                                    </label>
                                </div>
                                <div className="pt-4 mt-4 border-t border-navy/5">
                                    <button type="submit" className="w-full py-4 bg-navy text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-navy/90 hover:shadow-xl hover:shadow-navy/10 transition-all active:scale-95">
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
                        <div className="p-8 text-center space-y-4">
                            <div className="mx-auto w-16 h-16 bg-danger/10 rounded-full flex items-center justify-center mb-4">
                                <AlertTriangle size={32} className="text-danger" />
                            </div>
                            <h3 className="text-xl font-black text-navy uppercase tracking-tight">Hapus Perangkat?</h3>
                            <p className="text-xs font-medium text-navy/60">Data kamera akan dihapus secara permanen dari daftar jaringan. Operasi ini tidak dapat dibatalkan.</p>
                        </div>
                        <div className="p-4 bg-background/50 flex items-center space-x-4 border-t border-navy/5">
                            <button onClick={() => setDeleteCameraId(null)} className="flex-1 py-3 text-xs font-black uppercase tracking-widest text-navy/40 hover:bg-white hover:text-navy rounded-xl transition-all shadow-sm">
                                Batal
                            </button>
                            <button onClick={handleConfirmDelete} className="flex-1 py-3 bg-danger text-white text-xs font-black uppercase tracking-widest rounded-xl hover:bg-danger/90 hover:shadow-lg hover:shadow-danger/20 transition-all active:scale-95">
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
