import { useCallback, useEffect, useMemo, useState } from 'react';
import { userService } from '../../services/user/user.service';

function hasOnvifAccess(user) {
    const authorities = Array.isArray(user?.authorities)
        ? user.authorities
        : Array.isArray(user?.raw?.AuthorityList)
            ? user.raw.AuthorityList
            : [];

    return authorities.some((authority) => {
        const normalized = String(authority || '').toLowerCase();
        return normalized === 'authrmtdevice' || normalized.includes('onvif');
    });
}

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

function createInitialFormState() {
    return { ...INITIAL_FORM_STATE };
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
    const [statusMessage, setStatusMessage] = useState('');

    const [searchTerm, setSearchTerm] = useState('');

    const [isAddOpen, setIsAddOpen] = useState(false);
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [formData, setFormData] = useState(createInitialFormState);
    const [editTarget, setEditTarget] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [activeTab, setActiveTab] = useState('attribute');
    const [selectedGroup, setSelectedGroup] = useState('all');
    const [selectedUserForAttribute, setSelectedUserForAttribute] = useState(null);
    const [isTreeExpanded, setIsTreeExpanded] = useState(true);
    const [expandedGroups, setExpandedGroups] = useState({});
    const [selectedUserForPermission, setSelectedUserForPermission] = useState(null);
    const [onvifAvailable, setOnvifAvailable] = useState(false);
    const [onvifUsers, setOnvifUsers] = useState([]);
    const [isUserManagementSupported, setIsUserManagementSupported] = useState(true);

    const loadAllUsers = useCallback(async () => {
        try {
            setLoading(true);
            setError('');

            const [userResult, onvifDeviceResult] = await Promise.allSettled([
                userService.getAllUsers(),
                userService.getOnvifDevice(),
            ]);

            if (userResult.status === 'fulfilled') {
                const result = userResult.value;
                setUsers(Array.isArray(result?.users) ? result.users : []);
            } else {
                throw userResult.reason;
            }

            const localUsers = Array.isArray(userResult.value?.users) ? userResult.value.users : [];
            const onvifUsersList = localUsers.filter(hasOnvifAccess);
            const hasOnvif = onvifUsersList.length > 0 || (onvifDeviceResult.status === 'fulfilled' && Object.keys(onvifDeviceResult.value?.data || {}).length > 0);

            setOnvifAvailable(hasOnvif);
            setOnvifUsers(onvifUsersList);
            setStatusMessage('');
        } catch {
            setUsers([]);
            setOnvifAvailable(false);
            setOnvifUsers([]);
            setError('Gagal mengambil daftar user dari perangkat.');
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
    }, [users]);

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

    const selectedGroupUsers = useMemo(() => {
        if (normalizeSearch(selectedGroup) === 'onvif') {
            return onvifUsers;
        }

        if (selectedGroup === 'all') {
            return users;
        }

        return users.filter((user) => normalizeSearch(user.group) === normalizeSearch(selectedGroup));
    }, [onvifUsers, selectedGroup, users]);

    const selectedGroupInfo = useMemo(() => {
        if (normalizeSearch(selectedGroup) === 'onvif') {
            return {
                name: 'Onvif',
                parent: 'EvoSecure',
                description: `${onvifUsers.length} user di grup ini`,
            };
        }

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
    }, [onvifUsers.length, selectedGroup, selectedGroupUsers.length, userGroups, users.length]);

    const selectedAttributeUser = useMemo(() => {
        const normalizedTarget = normalizeSearch(selectedUserForAttribute);
        if (!normalizedTarget) {
            return null;
        }

        if (normalizeSearch(selectedGroup) === 'onvif') {
            return onvifUsers.find((user) => normalizeSearch(user.name) === normalizedTarget) || null;
        }

        return users.find((user) => normalizeSearch(user.name) === normalizedTarget) || null;
    }, [onvifUsers, selectedGroup, selectedUserForAttribute, users]);

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

    const handleDeleteUser = useCallback(async (user) => {
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
    }, [loadAllUsers]);


    return {
        users,
        loading,
        error,
        statusMessage,
        searchTerm,
        setSearchTerm,
        isAddOpen,
        isEditOpen,
        formData,
        setFormData,
        editTarget,
        submitting,
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
        openEditModal,
        closeAddModal,
        closeEditModal,
        handleAddUser,
        handleModifyUser,
        handleDeleteUser,
        selectedUserForPermission,
        setSelectedUserForPermission,
        onvifAvailable,
        onvifUsers,
        isUserManagementSupported,
    };
}
