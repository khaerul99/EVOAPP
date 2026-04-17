import React from 'react';
import {
    Search,
    UserPlus,
    Edit3,
    Trash2,
    RefreshCw,
    Loader2,
    ChevronRight,
    ChevronDown,
    Users,
    Shield,
} from 'lucide-react';
import { useUserManagement } from '../../../hooks/user/useUserManagement';

const UserManagement = () => {
    const {
        loading,
        error,
        statusMessage,
        searchTerm,
        setSearchTerm,
        
        isAddOpen,
        isEditOpen,
        formData,
        setFormData,
        submitting,
        filteredUsers,
        loadAllUsers,
        openAddModal,
        openEditModal,
        closeAddModal,
        closeEditModal,
        handleAddUser,
        handleModifyUser,
        handleDeleteUser,
        
        activeTab,
        setActiveTab,
        selectedGroup,
        setSelectedGroup,
        isTreeExpanded,
        setIsTreeExpanded,
        toggleGroupExpanded,
        isGroupExpanded,
        userGroups,
        selectedGroupUsers,
        selectedGroupInfo,
    } = useUserManagement();

    const isAttributeTab = activeTab === 'attribute';

    return (
        <div className="space-y-6 duration-500 animate-in fade-in md:space-y-8">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                    <h2 className="text-lg font-black tracking-tight text-navy md:text-2xl">USER MANAGEMENT</h2>
                    <p className="mt-1 text-xs font-semibold tracking-wide text-navy/40">
                        Struktur grup dan daftar user mengikuti pola panel seperti contoh.
                    </p>
                </div>

                <div className="flex items-center w-full gap-2 lg:w-auto">
                    <div className="relative w-full lg:w-72">
                        <Search size={16} className="absolute -translate-y-1/2 left-4 top-1/2 text-navy/30" />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(event) => setSearchTerm(event.target.value)}
                            placeholder="Cari username, group, atau authority..."
                            className="w-full py-3 pl-12 pr-4 text-xs font-bold transition-all bg-white border outline-none rounded-xl border-navy/5 focus:border-navy/20"
                        />
                    </div>
                    <button
                        type="button"
                        onClick={loadAllUsers}
                        className="p-3 transition-colors bg-white border rounded-xl border-navy/5 text-navy/50 hover:text-navy"
                        title="Refresh user list"
                    >
                        <RefreshCw size={18} />
                    </button>
                    <button
                        type="button"
                        onClick={openAddModal}
                        className="inline-flex items-center gap-2 px-4 py-3 text-xs font-black tracking-widest text-white uppercase shadow-lg rounded-xl bg-navy shadow-navy/10 hover:opacity-90"
                    >
                        <UserPlus size={16} />
                        Add User
                    </button>
                </div>
            </div>

            {(error || statusMessage) && (
                <div className={`rounded-2xl border p-4 text-xs font-bold ${error ? 'border-danger/20 bg-danger/10 text-danger' : 'border-navy/10 bg-background text-navy/70'}`}>
                    {error || statusMessage}
                </div>
            )}

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-[280px_1fr]">
                <aside className="overflow-hidden rounded-[28px] border border-navy/5 bg-white shadow-sm">
                    <div className="p-4 border-b border-navy/5">
                        <div className="flex items-center gap-3">
                            <div className="flex items-center justify-center w-10 h-10 text-white rounded-2xl bg-navy">
                                <Users size={18} />
                            </div>
                            <div>
                                <p className="text-xs font-black uppercase tracking-[0.22em] text-navy">EvoSecure</p>
                                <p className="text-[10px] font-bold uppercase tracking-widest text-navy/30">Tree View</p>
                            </div>
                        </div>
                    </div>

                    <div className="p-3">
                        <button
                            type="button"
                            onClick={() => setIsTreeExpanded((previous) => !previous)}
                            className={`flex w-full items-center justify-between rounded-2xl px-3 py-3 text-left transition-colors border ${isTreeExpanded ? 'border-navy/80 bg-navy/5 text-navy' : 'border-navy/15 bg-white text-navy/60 hover:bg-navy/5 hover:text-navy'}`}
                        >
                            <span className="flex items-center gap-3">
                                {isTreeExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                <span className="text-xs font-black tracking-widest uppercase">EvoSecure</span>
                            </span>
                            <span className="rounded-full bg-white px-2 py-1 text-[10px] font-black text-navy/40 shadow-sm">
                                {filteredUsers.length}
                            </span>
                        </button>

                        {isTreeExpanded && (
                            <div className="pl-4 mt-2 space-y-2">
                                {userGroups.map((group) => {
                                    const isActiveGroup = selectedGroup === group.groupName;
                                    const isOpen = isGroupExpanded(group.groupName);

                                    return (
                                        <div key={group.groupName} className="p-2 border rounded-2xl border-navy/5 bg-background/60">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setSelectedGroup(group.groupName);
                                                    toggleGroupExpanded(group.groupName);
                                                }}
                                                className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left transition-colors ${isActiveGroup ? 'bg-white text-navy shadow-sm' : 'text-navy/60 hover:bg-white hover:text-navy'}`}
                                            >
                                                <span className="flex items-center gap-2">
                                                    {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                                    <span className="text-xs font-black tracking-widest uppercase">{group.groupName}</span>
                                                </span>
                                                <span className="rounded-full bg-navy/5 px-2 py-1 text-[10px] font-black text-navy/50">
                                                    {group.users.length}
                                                </span>
                                            </button>

                                            {isOpen && (
                                                <div className="pl-4 mt-2 space-y-1">
                                                    {group.users.map((user) => (
                                                        <button
                                                            key={`${group.groupName}-${user.name}`}
                                                            type="button"
                                                            onClick={() => openEditModal(user)}
                                                            className="flex items-center justify-between w-full px-3 py-2 text-left transition-colors rounded-xl text-navy/45 hover:bg-white hover:text-navy"
                                                        >
                                                            <span className="flex items-center gap-2">
                                                                <Users size={14} />
                                                                <span className="text-[11px] font-bold">{user.name}</span>
                                                            </span>
                                                            <span className="text-[10px] font-bold uppercase tracking-widest text-navy/25">Edit</span>
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </aside>

                <section className="overflow-hidden rounded-[28px] border border-navy/5 bg-white shadow-sm">
                    <div className="flex items-center gap-4 px-4 pt-4 border-b border-navy/5 md:px-6">
                        <button
                            type="button"
                            onClick={() => setActiveTab('attribute')}
                            className={`border-b-2 px-1 py-3 text-sm font-bold transition-colors ${isAttributeTab ? 'border-navy text-navy' : 'border-transparent text-navy/40 hover:text-navy/60'}`}
                        >
                            Attribute
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab('permission')}
                            className={`border-b-2 px-1 py-3 text-sm font-bold transition-colors ${!isAttributeTab ? 'border-navy text-navy' : 'border-transparent text-navy/40 hover:text-navy/60'}`}
                        >
                            Permission
                        </button>
                    </div>

                    <div className="p-4 md:p-6">
                        {isAttributeTab ? (
                            <div className="space-y-6">
                                <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1fr]">
                                    <div className="space-y-4">
                                        <div className="grid grid-cols-1 gap-3 md:grid-cols-[120px_1fr] md:items-center">
                                            <label className="text-sm font-medium text-navy/80">Name</label>
                                            <input
                                                type="text"
                                                value={selectedGroupInfo.name}
                                                readOnly
                                                className="w-full px-4 py-2 text-sm font-medium border rounded-md outline-none border-navy/10 bg-background text-navy"
                                            />
                                        </div>
                                        <div className="grid grid-cols-1 gap-3 md:grid-cols-[120px_1fr] md:items-center">
                                            <label className="text-sm font-medium text-navy/80">Parent Node</label>
                                            <input
                                                type="text"
                                                value={selectedGroupInfo.parent}
                                                readOnly
                                                className="w-full px-4 py-2 text-sm font-medium border rounded-md outline-none border-navy/10 bg-background text-navy"
                                            />
                                        </div>
                                        <div className="grid grid-cols-1 gap-3 md:grid-cols-[120px_1fr] md:items-start">
                                            <label className="pt-2 text-sm font-medium text-navy/80">Description</label>
                                            <textarea
                                                value={selectedGroupInfo.description}
                                                readOnly
                                                rows={3}
                                                className="w-full px-4 py-2 text-sm font-medium border rounded-md outline-none border-navy/10 bg-background text-navy"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="overflow-hidden border rounded-2xl border-navy/5">
                                    <div className="px-4 py-3 border-b border-navy/5 md:px-5">
                                        <h3 className="text-sm font-medium text-navy/80">User List</h3>
                                    </div>

                                    <div className="overflow-x-auto">
                                        <table className="w-full min-w-[720px] border-collapse text-left">
                                            <thead>
                                                <tr className="text-sm font-semibold bg-background/60 text-navy/60">
                                                    <th className="px-4 py-3 text-center border-b border-navy/5">Username</th>
                                                    <th className="px-4 py-3 text-center border-b border-navy/5">Password</th>
                                                    <th className="px-4 py-3 text-center border-b border-navy/5">Description</th>
                                                    <th className="px-4 py-3 text-right border-b border-navy/5">Operation</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {selectedGroupUsers.map((user) => (
                                                    <tr key={`${user.name}-${user.group}`} className="text-sm text-navy/80">
                                                        <td className="px-4 py-4 font-medium text-center border-b border-navy/5">{user.name}</td>
                                                        <td className="px-4 py-4 font-medium text-center border-b border-navy/5">Hidden</td>
                                                        <td className="px-4 py-4 font-medium text-center border-b border-navy/5">{user.remark || `${user.name}'s account`}</td>
                                                        <td className="px-4 py-4 text-right border-b border-navy/5">
                                                            <div className="inline-flex items-center gap-2">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => openEditModal(user)}
                                                                    className="p-2 transition-all border border-transparent rounded-lg text-navy/40 hover:border-navy/10 hover:bg-navy/5 hover:text-navy"
                                                                    title="Modify user"
                                                                >
                                                                    <Edit3 size={14} />
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleDeleteUser(user)}
                                                                    className="p-2 transition-all border border-transparent rounded-lg text-danger/50 hover:border-danger/10 hover:bg-danger/5 hover:text-danger"
                                                                    title="Delete user"
                                                                >
                                                                    <Trash2 size={14} />
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                                {selectedGroupUsers.length === 0 && (
                                                    <tr>
                                                        <td className="px-4 py-8 text-sm text-center text-navy/30" colSpan={4}>
                                                            Tidak ada user pada group ini.
                                                        </td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div className="p-4 border rounded-2xl border-navy/5 bg-background/60">
                                    <div className="flex items-center gap-3">
                                        <div className="flex items-center justify-center w-10 h-10 text-white rounded-2xl bg-navy">
                                            <Shield size={18} />
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-navy">Permission</p>
                                            <p className="text-xs text-navy/40">Pengaturan permission mengikuti profil yang dipilih di perangkat.</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="overflow-hidden border rounded-2xl border-navy/5">
                                    <table className="w-full text-sm text-left border-collapse">
                                        <thead>
                                            <tr className="bg-background/60 text-navy/60">
                                                <th className="px-4 py-3 border-b border-navy/5">Permission</th>
                                                <th className="px-4 py-3 text-center border-b border-navy/5">Read</th>
                                                <th className="px-4 py-3 text-center border-b border-navy/5">Add</th>
                                                <th className="px-4 py-3 text-center border-b border-navy/5">Modify</th>
                                                <th className="px-4 py-3 text-center border-b border-navy/5">Delete</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {['User Profile', 'Device Access', 'Configuration', 'Security Log'].map((permission) => (
                                                <tr key={permission} className="text-navy/80">
                                                    <td className="px-4 py-3 font-medium border-b border-navy/5">{permission}</td>
                                                    {['read', 'add', 'modify', 'delete'].map((item) => (
                                                        <td key={item} className="px-4 py-3 text-center border-b border-navy/5">
                                                            <input type="checkbox" defaultChecked={item === 'read'} disabled className="w-4 h-4 rounded border-navy/20" />
                                                        </td>
                                                    ))}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>
                </section>
            </div>

            {(loading || submitting) && (
                <div className="p-4 text-center bg-white border shadow-sm rounded-2xl border-navy/5">
                    <div className="inline-flex items-center gap-2 text-xs font-bold text-navy/50">
                        <Loader2 size={16} className="animate-spin" />
                        {loading ? 'Memuat data user...' : 'Menyimpan perubahan...'}
                    </div>
                </div>
            )}

            {(isAddOpen || isEditOpen) && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-navy/30 p-4 backdrop-blur-sm">
                    <div className="w-full max-w-2xl p-6 bg-white border shadow-2xl rounded-3xl border-navy/10 md:p-8">
                        <h3 className="mb-6 text-sm font-black tracking-widest uppercase text-navy">
                            {isAddOpen ? 'Add New User' : 'Modify User'}
                        </h3>

                        <form onSubmit={isAddOpen ? handleAddUser : handleModifyUser} className="space-y-4">
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(event) => setFormData((prev) => ({ ...prev, name: event.target.value }))}
                                    placeholder="name"
                                    className="px-4 py-2 text-xs font-bold border outline-none rounded-xl border-navy/10 bg-background text-navy focus:border-navy/30"
                                    required
                                />
                                <input
                                    type="password"
                                    value={formData.password}
                                    onChange={(event) => setFormData((prev) => ({ ...prev, password: event.target.value }))}
                                    placeholder="password (opsional untuk modify)"
                                    className="px-4 py-2 text-xs font-bold border outline-none rounded-xl border-navy/10 bg-background text-navy focus:border-navy/30"
                                />
                                <input
                                    type="text"
                                    value={formData.group}
                                    onChange={(event) => setFormData((prev) => ({ ...prev, group: event.target.value }))}
                                    placeholder="group"
                                    className="px-4 py-2 text-xs font-bold border outline-none rounded-xl border-navy/10 bg-background text-navy focus:border-navy/30"
                                />
                                <input
                                    type="text"
                                    value={formData.authority}
                                    onChange={(event) => setFormData((prev) => ({ ...prev, authority: event.target.value }))}
                                    placeholder="authority"
                                    className="px-4 py-2 text-xs font-bold border outline-none rounded-xl border-navy/10 bg-background text-navy focus:border-navy/30"
                                />
                            </div>

                            <textarea
                                value={formData.remark}
                                onChange={(event) => setFormData((prev) => ({ ...prev, remark: event.target.value }))}
                                placeholder="remark"
                                rows={3}
                                className="w-full px-4 py-2 text-xs font-bold border outline-none resize-none rounded-xl border-navy/10 bg-background text-navy focus:border-navy/30"
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
                                    className="px-4 py-2 text-xs font-black tracking-widest uppercase border rounded-xl border-navy/10 text-navy/70"
                                    disabled={submitting}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="inline-flex items-center px-4 py-2 text-xs font-black tracking-widest text-white uppercase rounded-xl bg-navy disabled:opacity-60"
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
