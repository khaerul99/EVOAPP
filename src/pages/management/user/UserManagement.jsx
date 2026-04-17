import React, { useEffect, useState } from 'react';
import { Search, UserPlus, Edit3, Trash2, RefreshCw, Loader2 } from 'lucide-react';
import { userService } from '../../../services/user/user.service';

const initialFormState = {
    name: '',
    password: '',
    group: '',
    authority: '',
    remark: '',
    extraQuery: '',
};

const UserManagement = () => {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [statusMessage, setStatusMessage] = useState('');

    const [searchTerm, setSearchTerm] = useState('');
    const [lookupName, setLookupName] = useState('');
    const [lookupResult, setLookupResult] = useState(null);

    const [isAddOpen, setIsAddOpen] = useState(false);
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [formData, setFormData] = useState(initialFormState);
    const [editTarget, setEditTarget] = useState(null);
    const [submitting, setSubmitting] = useState(false);

    const loadAllUsers = async () => {
        try {
            setLoading(true);
            setError('');
            const result = await userService.getAllUsers();
            setUsers(Array.isArray(result?.users) ? result.users : []);
            setStatusMessage('');
        } catch {
            setUsers([]);
            setError('Gagal mengambil daftar user dari perangkat.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadAllUsers();
    }, []);

    const filteredUsers = users.filter((user) => {
        const normalizedSearch = searchTerm.toLowerCase();
        return (
            String(user.name || '').toLowerCase().includes(normalizedSearch)
            || String(user.group || '').toLowerCase().includes(normalizedSearch)
            || String(user.authority || '').toLowerCase().includes(normalizedSearch)
        );
    });

    const resetForm = () => {
        setFormData(initialFormState);
    };

    const openAddModal = () => {
        resetForm();
        setIsAddOpen(true);
    };

    const openEditModal = (user) => {
        setEditTarget(user);
        setFormData({
            name: user?.name === '-' ? '' : String(user?.name || ''),
            password: '',
            group: user?.group === '-' ? '' : String(user?.group || ''),
            authority: user?.authority === '-' ? '' : String(user?.authority || ''),
            remark: String(user?.remark || ''),
            extraQuery: '',
        });
        setIsEditOpen(true);
    };

    const closeAddModal = () => {
        setIsAddOpen(false);
        resetForm();
    };

    const closeEditModal = () => {
        setIsEditOpen(false);
        setEditTarget(null);
        resetForm();
    };

    const buildPayloadFromForm = () => {
        return {
            name: formData.name,
            password: formData.password,
            group: formData.group,
            authority: formData.authority,
            remark: formData.remark,
        };
    };

    const handleAddUser = async (event) => {
        event.preventDefault();
        if (!formData.name.trim()) {
            setStatusMessage('Nama user wajib diisi.');
            return;
        }

        try {
            setSubmitting(true);
            setStatusMessage('');
            await userService.addUser({
                payload: buildPayloadFromForm(),
                extraQuery: formData.extraQuery,
            });
            closeAddModal();
            await loadAllUsers();
            setStatusMessage('User berhasil ditambahkan.');
        } catch {
            setStatusMessage('Gagal menambahkan user. Periksa parameter tambahan yang dibutuhkan perangkat.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleModifyUser = async (event) => {
        event.preventDefault();
        if (!formData.name.trim()) {
            setStatusMessage('Nama user wajib diisi.');
            return;
        }

        try {
            setSubmitting(true);
            setStatusMessage('');
            await userService.modifyUser({
                payload: buildPayloadFromForm(),
                extraQuery: formData.extraQuery,
            });
            closeEditModal();
            await loadAllUsers();
            setStatusMessage('User berhasil diperbarui.');
        } catch {
            setStatusMessage('Gagal memperbarui user. Pastikan query parameter sesuai kebutuhan perangkat.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDeleteUser = async (user) => {
        const username = String(user?.name || '').trim();
        if (!username || username === '-') {
            setStatusMessage('Nama user tidak valid untuk dihapus.');
            return;
        }

        const confirmed = window.confirm(`Hapus user ${username}?`);
        if (!confirmed) {
            return;
        }

        const extraQuery = window.prompt('Tambahkan query string opsional untuk delete (contoh: force=true). Kosongkan jika tidak perlu:', '');

        try {
            setStatusMessage('');
            await userService.deleteUser({ name: username, extraQuery: extraQuery || '' });
            await loadAllUsers();
            setStatusMessage('User berhasil dihapus.');
        } catch {
            setStatusMessage('Gagal menghapus user dari perangkat.');
        }
    };

    const handleLookupUser = async (event) => {
        event.preventDefault();
        const normalizedName = lookupName.trim();
        if (!normalizedName) {
            setLookupResult(null);
            return;
        }

        try {
            setStatusMessage('');
            const result = await userService.getUserByName(normalizedName);
            setLookupResult(result?.user || null);
            if (!result?.user) {
                setStatusMessage('User tidak ditemukan untuk nama tersebut.');
            }
        } catch {
            setLookupResult(null);
            setStatusMessage('Gagal membaca detail user.');
        }
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
                <h2 className="text-lg font-black tracking-tight md:text-2xl text-navy">USER MANAGEMENT</h2>
                <div className="flex w-full items-center gap-2 md:w-auto">
                    <div className="relative w-full md:w-64">
                        <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-navy/30" />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(event) => setSearchTerm(event.target.value)}
                            placeholder="Cari user..."
                            className="w-full rounded-xl border border-navy/5 bg-white py-2 pl-12 pr-4 text-xs font-bold outline-none transition-all focus:border-navy/20"
                        />
                    </div>
                    <button
                        type="button"
                        onClick={loadAllUsers}
                        className="rounded-xl border border-navy/5 bg-white p-2 text-navy/50 transition-colors hover:text-navy"
                        title="Refresh user list"
                    >
                        <RefreshCw size={18} />
                    </button>
                    <button
                        type="button"
                        onClick={openAddModal}
                        className="flex items-center gap-2 rounded-xl bg-navy px-4 py-2 text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-navy/10 hover:opacity-90"
                    >
                        <UserPlus size={16} />
                        Add User
                    </button>
                </div>
            </div>

            <div className="rounded-3xl border border-navy/5 bg-white p-5 shadow-sm md:p-6">
                <h3 className="mb-3 text-xs font-black uppercase tracking-widest text-navy/40">Get Particular User</h3>
                <form onSubmit={handleLookupUser} className="flex flex-col items-start gap-3 md:flex-row md:items-center">
                    <input
                        type="text"
                        value={lookupName}
                        onChange={(event) => setLookupName(event.target.value)}
                        placeholder="Masukkan nama user"
                        className="w-full rounded-xl border border-navy/10 bg-background px-4 py-2 text-xs font-bold text-navy outline-none transition-all focus:border-navy/30 md:w-80"
                    />
                    <button
                        type="submit"
                        className="rounded-xl border border-navy/10 bg-background px-4 py-2 text-xs font-black uppercase tracking-widest text-navy"
                    >
                        Get User Info
                    </button>
                </form>

                {lookupResult && (
                    <div className="mt-4 rounded-2xl border border-navy/5 bg-background p-4 text-xs font-bold text-navy/80">
                        <p>Name: <span className="text-navy">{lookupResult.name}</span></p>
                        <p>Group: <span className="text-navy">{lookupResult.group}</span></p>
                        <p>Authority: <span className="text-navy">{lookupResult.authority}</span></p>
                        <p>Remark: <span className="text-navy">{lookupResult.remark || '-'}</span></p>
                    </div>
                )}
            </div>

            <div className="overflow-hidden rounded-3xl border border-navy/5 bg-white shadow-sm">
                <div className="border-b border-navy/5 px-5 py-4 md:px-6">
                    <h3 className="text-xs font-black uppercase tracking-widest text-navy/40">Get All Users</h3>
                </div>

                <div className="overflow-x-auto p-5 md:p-6">
                    {loading ? (
                        <div className="flex items-center justify-center py-10 text-sm font-bold text-navy/50">
                            <Loader2 size={18} className="mr-2 animate-spin" />
                            Memuat data user...
                        </div>
                    ) : (
                        <table className="w-full min-w-[720px] border-collapse text-left">
                            <thead>
                                <tr className="border-b-2 border-navy/5 text-[10px] font-black uppercase tracking-widest text-navy/40">
                                    <th className="pb-4 pr-6">No</th>
                                    <th className="pb-4">Name</th>
                                    <th className="pb-4">Group</th>
                                    <th className="pb-4">Authority</th>
                                    <th className="pb-4">Remark</th>
                                    <th className="pb-4 text-right">Operation</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-navy/5 text-xs font-bold text-navy/80">
                                {filteredUsers.map((user, index) => (
                                    <tr key={`${user.name}-${index}`} className="transition-colors hover:bg-background">
                                        <td className="py-4 pr-6 font-mono text-navy/40">{index + 1}</td>
                                        <td className="py-4 text-navy">{user.name}</td>
                                        <td className="py-4">{user.group}</td>
                                        <td className="py-4">{user.authority}</td>
                                        <td className="py-4">{user.remark || '-'}</td>
                                        <td className="py-4">
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => openEditModal(user)}
                                                    className="rounded-lg p-2 text-navy/40 transition-all hover:bg-navy/5 hover:text-navy"
                                                    title="Modify user"
                                                >
                                                    <Edit3 size={14} />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleDeleteUser(user)}
                                                    className="rounded-lg p-2 text-danger/60 transition-all hover:bg-danger/5 hover:text-danger"
                                                    title="Delete user"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}

                    {!loading && filteredUsers.length === 0 && (
                        <div className="py-10 text-center text-sm font-bold text-navy/30">
                            Tidak ada user yang ditemukan.
                        </div>
                    )}
                </div>
            </div>

            {error && (
                <div className="rounded-xl border border-danger/20 bg-danger/10 p-4 text-xs font-bold text-danger">
                    {error}
                </div>
            )}

            {statusMessage && (
                <div className="rounded-xl border border-navy/10 bg-background p-4 text-xs font-bold text-navy/70">
                    {statusMessage}
                </div>
            )}

            {(isAddOpen || isEditOpen) && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-navy/30 p-4 backdrop-blur-sm">
                    <div className="w-full max-w-2xl rounded-3xl border border-navy/10 bg-white p-6 shadow-2xl md:p-8">
                        <h3 className="mb-6 text-sm font-black uppercase tracking-widest text-navy">
                            {isAddOpen ? 'Add New User' : 'Modify User'}
                        </h3>

                        <form onSubmit={isAddOpen ? handleAddUser : handleModifyUser} className="space-y-4">
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(event) => setFormData((prev) => ({ ...prev, name: event.target.value }))}
                                    placeholder="name"
                                    className="rounded-xl border border-navy/10 bg-background px-4 py-2 text-xs font-bold text-navy outline-none focus:border-navy/30"
                                    required
                                />
                                <input
                                    type="password"
                                    value={formData.password}
                                    onChange={(event) => setFormData((prev) => ({ ...prev, password: event.target.value }))}
                                    placeholder="password (opsional untuk modify)"
                                    className="rounded-xl border border-navy/10 bg-background px-4 py-2 text-xs font-bold text-navy outline-none focus:border-navy/30"
                                />
                                <input
                                    type="text"
                                    value={formData.group}
                                    onChange={(event) => setFormData((prev) => ({ ...prev, group: event.target.value }))}
                                    placeholder="group"
                                    className="rounded-xl border border-navy/10 bg-background px-4 py-2 text-xs font-bold text-navy outline-none focus:border-navy/30"
                                />
                                <input
                                    type="text"
                                    value={formData.authority}
                                    onChange={(event) => setFormData((prev) => ({ ...prev, authority: event.target.value }))}
                                    placeholder="authority"
                                    className="rounded-xl border border-navy/10 bg-background px-4 py-2 text-xs font-bold text-navy outline-none focus:border-navy/30"
                                />
                            </div>

                            <textarea
                                value={formData.remark}
                                onChange={(event) => setFormData((prev) => ({ ...prev, remark: event.target.value }))}
                                placeholder="remark"
                                rows={3}
                                className="w-full resize-none rounded-xl border border-navy/10 bg-background px-4 py-2 text-xs font-bold text-navy outline-none focus:border-navy/30"
                            />

                            <textarea
                                value={formData.extraQuery}
                                onChange={(event) => setFormData((prev) => ({ ...prev, extraQuery: event.target.value }))}
                                placeholder="Parameter query tambahan (opsional), contoh: pwd=12345&authority=admin"
                                rows={2}
                                className="w-full resize-none rounded-xl border border-navy/10 bg-background px-4 py-2 font-mono text-[11px] text-navy outline-none focus:border-navy/30"
                            />

                            <p className="text-[10px] font-bold text-navy/50">
                                Jika perangkat membutuhkan format parameter khusus untuk add/modify user, isi pada kolom query tambahan.
                            </p>

                            <div className="flex items-center justify-end gap-2 pt-2">
                                <button
                                    type="button"
                                    onClick={isAddOpen ? closeAddModal : closeEditModal}
                                    className="rounded-xl border border-navy/10 px-4 py-2 text-xs font-black uppercase tracking-widest text-navy/70"
                                    disabled={submitting}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="inline-flex items-center rounded-xl bg-navy px-4 py-2 text-xs font-black uppercase tracking-widest text-white disabled:opacity-60"
                                    disabled={submitting}
                                >
                                    {submitting && <Loader2 size={14} className="mr-2 animate-spin" />}
                                    {isAddOpen ? 'Submit Add' : 'Submit Modify'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default UserManagement;
