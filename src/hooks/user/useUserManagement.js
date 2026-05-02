import { useCallback, useEffect, useMemo, useState } from 'react';
import { userService } from '../../services/user/user.service';
import { authStore } from '../../stores/authSlice';
import { permissionService } from '../../services/user/permission.service';

const INITIAL_FORM_STATE = {
    name: '',
    oldPassword: '',
    password: '',
    group: '',
    authority: '',
    remark: '',
    sharable: true,
    reserved: false,
    needModPwd: false,
    extraQuery: '',
};

const INITIAL_GROUP_FORM_STATE = {
    name: '',
    memo: '',
    authority: '',
};

function createInitialFormState() {
    return { ...INITIAL_FORM_STATE };
}

function createInitialGroupFormState() {
    return { ...INITIAL_GROUP_FORM_STATE };
}

function normalizeSearch(value) {
    return String(value || '').toLowerCase();
}

function createEditFormState(user) {
    return {
        name: user?.name === '-' ? '' : String(user?.name || ''),
        oldPassword: '',
        password: '',
        group: user?.group === '-' ? '' : String(user?.group || ''),
        authority: Array.isArray(user?.authorities)
            ? user.authorities.join(',')
            : (user?.authority === '-' ? '' : String(user?.authority || '')),
        remark: String(user?.remark || ''),
        sharable: user?.raw?.Sharable !== undefined ? String(user.raw.Sharable).toLowerCase() === 'true' : true,
        reserved: user?.raw?.Reserved !== undefined ? String(user.raw.Reserved).toLowerCase() === 'true' : false,
        needModPwd: user?.raw?.NeedModPwd !== undefined ? String(user.raw.NeedModPwd).toLowerCase() === 'true' : false,
        extraQuery: '',
    };
}

function buildPayloadFromForm(formData) {
    return {
        name: formData.name,
        password: formData.password,
        group: formData.group,
        authority: formData.authority,
        remark: formData.remark,
        sharable: formData.sharable,
        reserved: formData.reserved,
        needModPwd: formData.needModPwd,
    };
}

export function useUserManagement() {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [groups, setGroups] = useState([]);
    const [statusMessage, setStatusMessage] = useState('');

    const [searchTerm, setSearchTerm] = useState('');

    const [isAddOpen, setIsAddOpen] = useState(false);
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [isGroupAuthOpen, setIsGroupAuthOpen] = useState(false);
    const [isAddGroupOpen, setIsAddGroupOpen] = useState(false);
    const [formData, setFormData] = useState(createInitialFormState);
    const [groupFormData, setGroupFormData] = useState(createInitialGroupFormState);
    const [groupAuthPassword, setGroupAuthPassword] = useState('');
    const [groupEditorTab, setGroupEditorTab] = useState('attribute');
    const [groupPermissionChannels, setGroupPermissionChannels] = useState([]);
    const [editTarget, setEditTarget] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [activeTab, setActiveTab] = useState('attribute');
    const [selectedGroup, setSelectedGroup] = useState('all');
    const [selectedUserForAttribute, setSelectedUserForAttribute] = useState(null);
    const [isTreeExpanded, setIsTreeExpanded] = useState(true);
    const [expandedGroups, setExpandedGroups] = useState({});
    const [selectedUserForPermission, setSelectedUserForPermission] = useState(null);
    const [isUserManagementSupported, setIsUserManagementSupported] = useState(true);
    const [currentUsername] = useState(() => String(authStore.getState()?.auth?.username || '').trim());
    const [isDeleteAuthOpen, setIsDeleteAuthOpen] = useState(false);
    const [deleteAuthPassword, setDeleteAuthPassword] = useState('');
    const [pendingDeleteTarget, setPendingDeleteTarget] = useState(null);
    const [deleteNotification, setDeleteNotification] = useState(null);

    const loadAllUsers = useCallback(async () => {
        try {
            setLoading(true);
            setError('');
            const [userResult, groupResult] = await Promise.allSettled([
                userService.getAllUsers(),
                userService.getAllGroups(),
            ]);

            if (userResult.status === 'fulfilled') {
                const usersList = Array.isArray(userResult.value?.users) ? userResult.value.users : [];
                setUsers(usersList);
            } else {
                throw userResult.reason;
            }

            const groupsList = groupResult.status === 'fulfilled'
                ? (Array.isArray(groupResult.value?.groups) ? groupResult.value.groups : [])
                : [];
            setGroups(groupsList);

            setStatusMessage('');
        } catch (err) {
            setUsers([]);
            setGroups([]);
            const status = err?.response?.status || (err && err.status);
            if (status === 401 || status === 403) {
                setError('Autentikasi gagal (401/403). Silakan cek kredensial atau login ulang.');
            } else {
                setError('Gagal mengambil daftar user dari perangkat.');
            }
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadAllUsers();
    }, []);

    const filteredUsers = useMemo(() => {
        const normalizedSearch = normalizeSearch(searchTerm);
        const groupedUsers = users.filter((user) => {
            return normalizeSearch(user.name).includes(normalizedSearch)
                || normalizeSearch(user.group).includes(normalizedSearch)
                || normalizeSearch(user.authority).includes(normalizedSearch);
        });

        if (selectedGroup === 'all') {
            return groupedUsers;
        }

        return groupedUsers.filter((user) => normalizeSearch(user.group) === normalizeSearch(selectedGroup));
    }, [searchTerm, selectedGroup, users]);

    const userGroups = useMemo(() => {
        // Prefer groups from endpoint if available. Keep groups even if they have 0 users.
        if (Array.isArray(groups) && groups.length > 0) {
            return groups
                .map((group) => {
                    const groupName = String(group.groupName || group.name || 'ungrouped').trim() || 'ungrouped';
                    const groupUsers = users.filter((user) => normalizeSearch(user.group) === normalizeSearch(groupName));

                    return {
                        ...group,
                        groupName,
                        users: groupUsers,
                    };
                })
                .sort((left, right) => left.groupName.localeCompare(right.groupName));
        }

        // Fallback: infer groups from users
        const grouped = users.reduce((accumulator, user) => {
            const groupName = String(user.group || 'ungrouped').trim() || 'ungrouped';

            if (!accumulator[groupName]) {
                accumulator[groupName] = [];
            }

            accumulator[groupName].push(user);
            return accumulator;
        }, {});

        return Object.entries(grouped)
            .sort(([left], [right]) => left.localeCompare(right))
            .map(([groupName, groupUsers]) => ({
                groupName,
                users: groupUsers,
            }));
    }, [groups, users]);

    useEffect(() => {
        if (!userGroups.length) {
            return;
        }

        setExpandedGroups((previous) => {
            if (Object.keys(previous).length > 0) {
                return previous;
            }

            return {
                [userGroups[0].groupName]: true,
            };
        });
    }, [userGroups]);

    useEffect(() => {
        if (isDeleteAuthOpen) {
            setDeleteAuthPassword('');
        }
    }, [isDeleteAuthOpen]);

    const selectedGroupUsers = useMemo(() => {
        if (selectedGroup === 'all') {
            return users;
        }

        return users.filter((user) => normalizeSearch(user.group) === normalizeSearch(selectedGroup));
    }, [selectedGroup, users]);

    const selectedGroupInfo = useMemo(() => {
        if (selectedGroup === 'all') {
            return {
                name: 'EvoSecure',
                parent: '-',
                description: `${users.length} user terdaftar`,
            };
        }

        const matchedGroup = userGroups.find((entry) => entry.groupName === selectedGroup);
        return {
            name: selectedGroup,
            parent: 'EvoSecure',
            description: `${matchedGroup?.users?.length || selectedGroupUsers.length} user di grup ini`,
        };
    }, [selectedGroup, selectedGroupUsers.length, userGroups, users.length, groups]);

    const selectedAttributeUser = useMemo(() => {
        const normalizedTarget = normalizeSearch(selectedUserForAttribute);
        if (!normalizedTarget) {
            return null;
        }

        return users.find((user) => normalizeSearch(user.name) === normalizedTarget) || null;
    }, [selectedUserForAttribute, users]);

    const selectedAttributeInfo = useMemo(() => {
        if (!selectedAttributeUser) {
            return {
                name: selectedGroupInfo.name,
                parent: selectedGroupInfo.parent,
                description: selectedGroupInfo.description,
                password: '',
                isUserNode: false,
            };
        }

        return {
            name: selectedAttributeUser.name,
            parent: selectedAttributeUser.group || selectedGroupInfo.name,
            description: selectedAttributeUser.remark || `${selectedAttributeUser.name}'s account`,
            password: '************',
            isUserNode: true,
        };
    }, [selectedAttributeUser, selectedGroupInfo]);

    const resetForm = useCallback(() => {
        setFormData(createInitialFormState());
    }, []);

    const toggleGroupExpanded = useCallback((groupName) => {
        setExpandedGroups((previous) => ({
            ...previous,
            [groupName]: !previous[groupName],
        }));
    }, []);

    const isGroupExpanded = useCallback((groupName) => Boolean(expandedGroups[groupName]), [expandedGroups]);

    const openAddModal = useCallback(() => {
        setEditTarget(null);
        resetForm();
        setIsEditOpen(false);
        setIsAddOpen(true);
    }, [resetForm]);

    const openEditModal = useCallback((user) => {
        setEditTarget(user);
        setFormData(createEditFormState(user));
        setIsAddOpen(false);
        setIsEditOpen(true);
    }, []);

    const closeAddModal = useCallback(() => {
        setIsAddOpen(false);
        resetForm();
    }, [resetForm]);

    const closeEditModal = useCallback(() => {
        setIsEditOpen(false);
        setEditTarget(null);
        resetForm();
    }, [resetForm]);

    const closeGroupAuthModal = useCallback(() => {
        setIsGroupAuthOpen(false);
        setGroupAuthPassword('');
    }, []);

    const closeAddGroupModal = useCallback(() => {
        setIsAddGroupOpen(false);
        setGroupFormData(createInitialGroupFormState());
        setGroupEditorTab('attribute');
    }, []);

    const closeDeleteAuthModal = useCallback(() => {
        setIsDeleteAuthOpen(false);
        setDeleteAuthPassword('');
        setPendingDeleteTarget(null);
    }, []);

    const openAddGroupAuthModal = useCallback(() => {
        setIsAddOpen(false);
        setIsEditOpen(false);
        setIsAddGroupOpen(false);
        setGroupFormData(createInitialGroupFormState());
        setGroupAuthPassword('');
        setGroupEditorTab('attribute');
        setIsGroupAuthOpen(true);
    }, []);

    const loadGroupPermissionChannels = useCallback(async () => {
        try {
            const abilities = await permissionService.getAbility();
            const channels = Object.entries(abilities || {})
                .map(([key, value]) => {
                    const match = String(key || '').match(/^Channel(\d+)$/i);
                    if (!match) {
                        return null;
                    }

                    const id = Number(match[1]);
                    if (!Number.isFinite(id) || id <= 0) {
                        return null;
                    }

                    return {
                        id,
                        name: String(value || `Channel${id}`),
                    };
                })
                .filter(Boolean)
                .sort((left, right) => left.id - right.id);

            setGroupPermissionChannels(channels);
        } catch {
            setGroupPermissionChannels([]);
        }
    }, []);

    const confirmGroupAuth = useCallback(async (event) => {
        event.preventDefault();
        if (!String(groupAuthPassword || '').trim()) {
            setStatusMessage('Password autentikasi wajib diisi.');
            return;
        }

        setStatusMessage('');
        await loadGroupPermissionChannels();
        setIsGroupAuthOpen(false);
        setIsAddGroupOpen(true);
    }, [groupAuthPassword, loadGroupPermissionChannels]);

    const handleAddGroup = useCallback(async (event) => {
        event.preventDefault();

        const groupName = String(groupFormData.name || '').trim();
        if (!groupName) {
            setStatusMessage('Nama group wajib diisi.');
            return;
        }

        if (!String(groupAuthPassword || '').trim()) {
            setStatusMessage('Password autentikasi wajib diisi.');
            setIsAddGroupOpen(false);
            setIsGroupAuthOpen(true);
            return;
        }

        try {
            setSubmitting(true);
            setStatusMessage('');

            await userService.addGroup({
                payload: {
                    name: groupFormData.name,
                    memo: groupFormData.memo,
                    authority: groupFormData.authority,
                },
                authPassword: groupAuthPassword,
            });

            closeAddGroupModal();
            setGroupAuthPassword('');
            await loadAllUsers();
            setStatusMessage('Group berhasil ditambahkan.');
        } catch {
            setStatusMessage('Gagal menambahkan group. Periksa password autentikasi dan parameter group.');
        } finally {
            setSubmitting(false);
        }
    }, [closeAddGroupModal, groupAuthPassword, groupFormData, loadAllUsers]);

    const handleAddUser = useCallback(async (event) => {
        event.preventDefault();
        if (!formData.name.trim()) {
            setStatusMessage('Nama user wajib diisi.');
            return;
        }

        if (!formData.password.trim()) {
            setStatusMessage('Password wajib diisi saat menambah user.');
            return;
        }

        try {
            setSubmitting(true);
            setStatusMessage('');
            await userService.addUser({
                payload: buildPayloadFromForm(formData),
                extraQuery: formData.extraQuery,
            });
            closeAddModal();
            await loadAllUsers();
            setStatusMessage('User berhasil ditambahkan.');
        } catch (error) {
            const status = error?.response?.status;
            if (status === 501) {
                setIsUserManagementSupported(false);
                setStatusMessage('Perangkat tidak mendukung penambahan user.');
            } else {
                setStatusMessage('Gagal menambahkan user. Periksa parameter tambahan yang dibutuhkan perangkat.');
            }
        } finally {
            setSubmitting(false);
        }
    }, [closeAddModal, formData, loadAllUsers]);

    const handleModifyUser = useCallback(async (event) => {
        event.preventDefault();
        if (!formData.name.trim()) {
            setStatusMessage('Nama user wajib diisi.');
            return;
        }

        const hasNewPassword = Boolean(formData.password.trim());
        const hasOldPassword = Boolean(formData.oldPassword.trim());
        const shouldModifyPassword = hasNewPassword || hasOldPassword;

        if (shouldModifyPassword && (!hasNewPassword || !hasOldPassword)) {
            setStatusMessage('Untuk ubah password, old password dan new password wajib diisi.');
            return;
        }

        try {
            setSubmitting(true);
            setStatusMessage('');

            try {
                await userService.modifyUser({
                    payload: buildPayloadFromForm({
                        ...formData,
                        password: '',
                    }),
                    extraQuery: formData.extraQuery,
                });
            } catch (error) {
                const status = error?.response?.status;
                if (status === 501) {
                    setIsUserManagementSupported(false);
                    throw new Error('Perangkat tidak mendukung perubahan user.');
                }
                throw error;
            }

            if (shouldModifyPassword) {
                await userService.modifyPassword({
                    name: formData.name,
                    pwd: formData.password,
                    pwdOld: formData.oldPassword,
                    extraQuery: formData.extraQuery,
                });
            }

            closeEditModal();
            await loadAllUsers();
            setStatusMessage(shouldModifyPassword ? 'User dan password berhasil diperbarui.' : 'User berhasil diperbarui.');
        } catch {
            setStatusMessage('Gagal memperbarui user. Pastikan query parameter sesuai kebutuhan perangkat.');
        } finally {
            setSubmitting(false);
        }
    }, [closeEditModal, formData, loadAllUsers]);

    const handleDeleteUser = useCallback(async ({ user, authPassword = '' }) => {
        const username = String(user?.name || '').trim();
        if (!username || username === '-') {
            setStatusMessage('Nama user tidak valid untuk dihapus.');
            return;
        }

        if (!String(authPassword || '').trim()) {
            setStatusMessage('Password autentikasi wajib diisi.');
            return;
        }

        try {
            setSubmitting(true);
            setStatusMessage('');
            await userService.deleteUser({ name: username, authPassword });
            await loadAllUsers();
            setStatusMessage('User berhasil dihapus.');
            setDeleteNotification({
                type: 'success',
                title: 'User Dihapus',
                message: `User "${username}" telah berhasil dihapus.`,
            });
        } catch {
            setStatusMessage('Gagal menghapus user dari perangkat.');
        } finally {
            setSubmitting(false);
        }
    }, [loadAllUsers]);

    const canDeleteGroup = useCallback((group) => {
        const groupName = String(group?.groupName || '').trim().toLowerCase();
        if (!groupName) {
            return false;
        }

        const reservedGroups = new Set(['evosecure', 'admin', 'onvif']);
        if (reservedGroups.has(groupName)) {
            return false;
        }

        return Array.isArray(group?.users) && group.users.length === 0;
    }, []);

    const handleDeleteGroup = useCallback(async ({ group, authPassword = '' }) => {
        const groupName = String(group?.groupName || '').trim();
        if (!canDeleteGroup(group)) {
            setStatusMessage('Group hanya bisa dihapus jika kosong.');
            return;
        }

        if (!String(authPassword || '').trim()) {
            setStatusMessage('Password autentikasi wajib diisi.');
            return;
        }

        try {
            setSubmitting(true);
            setStatusMessage('');
            await userService.deleteGroup({ name: groupName, authPassword });
            await loadAllUsers();
            setStatusMessage('Group berhasil dihapus.');
            setDeleteNotification({
                type: 'success',
                title: 'Group Dihapus',
                message: `Group "${groupName}" telah berhasil dihapus.`,
            });
        } catch {
            setStatusMessage('Gagal menghapus group. Pastikan group kosong dan password autentikasi benar.');
        } finally {
            setSubmitting(false);
        }
    }, [canDeleteGroup, loadAllUsers]);

    const openDeleteAuthModal = useCallback((target) => {
        if (!target) {
            return;
        }

        if (target.kind === 'group' && !canDeleteGroup(target.group)) {
            setStatusMessage('Group hanya bisa dihapus jika kosong.');
            return;
        }

        setPendingDeleteTarget(target);
        setDeleteAuthPassword('');
        setIsDeleteAuthOpen(true);
    }, [canDeleteGroup]);

    const confirmDeleteAuth = useCallback(async (event) => {
        event.preventDefault();

        const authPassword = String(deleteAuthPassword || '').trim();
        if (!authPassword) {
            setStatusMessage('Password autentikasi wajib diisi.');
            return;
        }

        if (!pendingDeleteTarget) {
            setStatusMessage('Target hapus tidak ditemukan.');
            return;
        }

        try {
            if (pendingDeleteTarget.kind === 'user') {
                await handleDeleteUser({ user: pendingDeleteTarget.user, authPassword });
            } else if (pendingDeleteTarget.kind === 'group') {
                await handleDeleteGroup({ group: pendingDeleteTarget.group, authPassword });
            }
            closeDeleteAuthModal();
        } catch {
            // handler already sets message
        }
    }, [closeDeleteAuthModal, deleteAuthPassword, handleDeleteGroup, handleDeleteUser, pendingDeleteTarget]);


    return {
        users,
        loading,
        error,
        statusMessage,
        searchTerm,
        setSearchTerm,
        isAddOpen,
        isEditOpen,
        isGroupAuthOpen,
        isAddGroupOpen,
        formData,
        setFormData,
        groupFormData,
        setGroupFormData,
        groupAuthPassword,
        setGroupAuthPassword,
        groupEditorTab,
        setGroupEditorTab,
        groupPermissionChannels,
        editTarget,
        submitting,
        currentUsername,
        activeTab,
        setActiveTab,
        selectedGroup,
        setSelectedGroup,
        isTreeExpanded,
        setIsTreeExpanded,
        expandedGroups,
        setExpandedGroups,
        toggleGroupExpanded,
        isGroupExpanded,
        userGroups,
        selectedGroupUsers,
        selectedGroupInfo,
        selectedAttributeInfo,
        selectedAttributeUser,
        selectedUserForAttribute,
        setSelectedUserForAttribute,
        filteredUsers,
        loadAllUsers,
        openAddModal,
        openAddGroupAuthModal,
        openEditModal,
        closeAddModal,
        closeEditModal,
        closeGroupAuthModal,
        closeAddGroupModal,
        isDeleteAuthOpen,
        deleteAuthPassword,
        setDeleteAuthPassword,
        closeDeleteAuthModal,
        openDeleteAuthModal,
        confirmDeleteAuth,
        confirmGroupAuth,
        handleAddUser,
        handleAddGroup,
        handleModifyUser,
        handleDeleteUser,
        canDeleteGroup,
        handleDeleteGroup,
        selectedUserForPermission,
        setSelectedUserForPermission,
        isUserManagementSupported,
        deleteNotification,
        setDeleteNotification,
    };
}
