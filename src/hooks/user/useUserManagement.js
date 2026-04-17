import { useCallback, useEffect, useMemo, useState } from 'react';
import { userService } from '../../services/user/user.service';

const INITIAL_FORM_STATE = {
    name: '',
    password: '',
    group: '',
    authority: '',
    remark: '',
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
        password: '',
        group: user?.group === '-' ? '' : String(user?.group || ''),
        authority: user?.authority === '-' ? '' : String(user?.authority || ''),
        remark: String(user?.remark || ''),
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
    const [isTreeExpanded, setIsTreeExpanded] = useState(true);
    const [expandedGroups, setExpandedGroups] = useState({});

    const loadAllUsers = useCallback(async () => {
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
    }, []);

    useEffect(() => {
        loadAllUsers();
    }, [loadAllUsers]);

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
    }, [selectedGroup, selectedGroupUsers.length, userGroups, users.length]);

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
        } catch {
            setStatusMessage('Gagal menambahkan user. Periksa parameter tambahan yang dibutuhkan perangkat.');
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

        try {
            setSubmitting(true);
            setStatusMessage('');
            await userService.modifyUser({
                payload: buildPayloadFromForm(formData),
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
        filteredUsers,
        loadAllUsers,
        openAddModal,
        openEditModal,
        closeAddModal,
        closeEditModal,
        handleAddUser,
        handleModifyUser,
        handleDeleteUser,
       
    };
}
