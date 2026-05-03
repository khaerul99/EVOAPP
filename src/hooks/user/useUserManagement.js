import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { userService } from '../../services/user/user.service';
import { cameraService } from '../../services/camera/camera.service';
import { authStore } from '../../stores/authSlice';
import { permissionService } from '../../services/user/permission.service';
import { loginWithDigest } from '../../services/auth/auth.service';

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

function detectOwnerFromPayload(payload = {}) {
    const ownerKeys = [
        'Creator',
        'creator',
        'CreateBy',
        'createBy',
        'Owner',
        'owner',
        'ManagerName',
        'managerName',
    ];

    for (const key of ownerKeys) {
        const value = String(payload?.[key] || '').trim();
        if (value) {
            return value;
        }
    }

    for (const [key, value] of Object.entries(payload || {})) {
        if (!/(creator|createby|owner|managername)/i.test(String(key))) {
            continue;
        }
        const text = String(value || '').trim();
        if (text) {
            return text;
        }
    }

    return '';
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

function cleanErrorText(value) {
    return String(value || '')
        .replace(/\s+/g, ' ')
        .replace(/<[^>]*>/g, ' ')
        .trim();
}

function getSelfPasswordChangeErrorMessage(error) {
    const status = error?.response?.status;
    const rawResponse = error?.response?.data;
    const responseText = cleanErrorText(
        typeof rawResponse === 'string'
            ? rawResponse
            : rawResponse?.message || rawResponse?.error || rawResponse?.msg || rawResponse?.detail || rawResponse?.description || rawResponse?.reason || rawResponse?.errorMessage || rawResponse?.errorMsg,
    ).toLowerCase();

    if (
        status === 401
        || status === 403
        || responseText.includes('old password')
        || responseText.includes('invalid old password')
        || responseText.includes('incorrect old password')
        || responseText.includes('old password incorrect')
        || responseText.includes('old password wrong')
        || responseText.includes('password lama')
        || responseText.includes('password salah')
        || responseText.includes('password tidak benar')
        || responseText.includes('pwdold')
        || responseText.includes('password old')
        || responseText.includes('wrong password')
        || responseText.includes('incorrect password')
    ) {
        return 'Old password salah.';
    }

    if (responseText.includes('too weak') || responseText.includes('weak password') || responseText.includes('password too weak')) {
        return 'Password terlalu lemah.';
    }

    if (responseText) {
        return cleanErrorText(responseText).slice(0, 240);
    }

    if (status === 400) {
        return 'Gagal memperbarui password. Pastikan old password benar.';
    }

    return error?.message || 'Gagal memperbarui password. Pastikan old password benar.';
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
    const [isAddUserAuthOpen, setIsAddUserAuthOpen] = useState(false);
    const [formData, setFormData] = useState(createInitialFormState);
    const [groupFormData, setGroupFormData] = useState(createInitialGroupFormState);
    const [groupAuthPassword, setGroupAuthPassword] = useState('');
    const [groupAuthMessage, setGroupAuthMessage] = useState('');
    const [addUserAuthPassword, setAddUserAuthPassword] = useState('');
    const [addUserAuthMessage, setAddUserAuthMessage] = useState('');
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
    const [deleteAuthMessage, setDeleteAuthMessage] = useState('');
    const [pendingDeleteTarget, setPendingDeleteTarget] = useState(null);
    const [deleteNotification, setDeleteNotification] = useState(null);
    const [addEditNotification, setAddEditNotification] = useState(null);

    // UI State - Password Visibility
    const [showDeletePassword, setShowDeletePassword] = useState(false);
    const [showGroupPassword, setShowGroupPassword] = useState(false);
    const [showUserPwdAuthPassword, setShowUserPwdAuthPassword] = useState(false);
    const [showUserPwdManagerPassword, setShowUserPwdManagerPassword] = useState(false);
    const [showUserPwdNewValue, setShowUserPwdNewValue] = useState(false);
    const [showUserPwdOldValue, setShowUserPwdOldValue] = useState(false);
    const [showUserPwdConfirmValue, setShowUserPwdConfirmValue] = useState(false);
    const [showAddUserAuthPassword, setShowAddUserAuthPassword] = useState(false);
    const [showGroupAttrAuthPassword, setShowGroupAttrAuthPassword] = useState(false);

    // UI State - Modal Control
    const [isUserPwdManagerOpen, setIsUserPwdManagerOpen] = useState(false);
    const [isUserPwdAuthOpen, setIsUserPwdAuthOpen] = useState(false);
    const [isGroupAttrAuthOpen, setIsGroupAttrAuthOpen] = useState(false);

    // UI State - Form Inputs
    const [userPwdAuthPassword, setUserPwdAuthPassword] = useState('');
    const [userPwdManagerPassword, setUserPwdManagerPassword] = useState('');
    const [userPwdNewValue, setUserPwdNewValue] = useState('');
    const [userPwdOldValue, setUserPwdOldValue] = useState('');
    const [userPwdConfirmValue, setUserPwdConfirmValue] = useState('');
    const [userDescriptionDraft, setUserDescriptionDraft] = useState('');
    const [userPwdAuthMode, setUserPwdAuthMode] = useState('changePassword');
    const [pendingUserDescriptionApply, setPendingUserDescriptionApply] = useState(null);
    const [editAuthPassword, setEditAuthPassword] = useState('');
    const [addUserConfirmPassword, setAddUserConfirmPassword] = useState('');
    const [groupAttrName, setGroupAttrName] = useState('');
    const [groupAttrMemo, setGroupAttrMemo] = useState('');
    const [groupAttrAuthPassword, setGroupAttrAuthPassword] = useState('');

    // UI State - Messages & Errors
    const [userPwdModalMessage, setUserPwdModalMessage] = useState('');
    const [userPwdOldError, setUserPwdOldError] = useState('');

    // UI State - Display & Pagination
    const [showAllChannels, setShowAllChannels] = useState(false);
    const [channelPage, setChannelPage] = useState(1);

    // Refs
    const deletePasswordFormRef = useRef(null);
    const groupPasswordFormRef = useRef(null);
    const groupAttrPasswordFormRef = useRef(null);

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
        const groupMemo = String(
            matchedGroup?.memo
            || matchedGroup?.raw?.Memo
            || matchedGroup?.raw?.memo
            || '',
        ).trim();
        return {
            name: selectedGroup,
            parent: 'EvoSecure',
            description: groupMemo || `${matchedGroup?.users?.length || selectedGroupUsers.length} user di grup ini`,
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

    const canEditSelectedAttribute = useMemo(() => {
        const normalizedCurrent = normalizeSearch(currentUsername);
        if (!normalizedCurrent) {
            return false;
        }

        if (selectedAttributeUser) {
            const owner = detectOwnerFromPayload(selectedAttributeUser?.raw || {});
            const normalizedOwner = normalizeSearch(owner);
            const normalizedUserName = normalizeSearch(selectedAttributeUser?.name || '');
            const protectedNames = new Set(['admin', 'administrator', 'onvif', 'evosecure']);
            const isProtectedTarget = protectedNames.has(normalizedUserName);
            const isOwnerMatch = Boolean(normalizedOwner) && normalizedOwner === normalizedCurrent;
            const canFallbackEdit = !normalizedOwner && !isProtectedTarget;
            return isOwnerMatch || canFallbackEdit;
        }

        if (selectedGroup === 'all') {
            return false;
        }

        const matchedGroup = userGroups.find((entry) => entry.groupName === selectedGroup);
        const owner = detectOwnerFromPayload(matchedGroup?.raw || {});
        const normalizedOwner = normalizeSearch(owner);
        const normalizedGroupName = normalizeSearch(selectedGroup);
        const protectedNames = new Set(['admin', 'administrator', 'onvif', 'evosecure']);
        const isProtectedTarget = protectedNames.has(normalizedGroupName);
        const isOwnerMatch = Boolean(normalizedOwner) && normalizedOwner === normalizedCurrent;
        const canFallbackEdit = !normalizedOwner && !isProtectedTarget;
        return isOwnerMatch || canFallbackEdit;
    }, [currentUsername, selectedAttributeUser, selectedGroup, userGroups]);

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

    const openAddUserAuthModal = useCallback(() => {
        setIsAddUserAuthOpen(true);
        setAddUserAuthPassword('');
        setAddUserAuthMessage('');
    }, []);

    const closeAddUserAuthModal = useCallback(() => {
        setIsAddUserAuthOpen(false);
        setAddUserAuthPassword('');
        setAddUserAuthMessage('');
    }, []);

    const confirmAddUserAuth = useCallback(async (event) => {
        event.preventDefault();
        if (!String(addUserAuthPassword || '').trim()) {
            setAddUserAuthMessage('Password autentikasi wajib diisi.');
            return;
        }

        setAddUserAuthMessage('');
        try {
            const probe = await loginWithDigest(currentUsername, String(addUserAuthPassword || ''));
            if (probe && probe.requiresDigest === false) {
                setAddUserAuthMessage('Perangkat tidak dapat memverifikasi kredensial melalui endpoint probe. Operasi dibatalkan.');
                return;
            }

            setIsAddUserAuthOpen(false);
            setIsAddOpen(true);
        } catch (error) {
            const serverMessage =
                (error?.response && (typeof error.response.data === 'string' ? error.response.data : error.response.data?.message))
                || error?.message
                || 'Gagal memvalidasi password. Periksa password autentikasi.';
            setAddUserAuthMessage(String(serverMessage));
        }
    }, [currentUsername, addUserAuthPassword]);

    const openAddModal = useCallback(() => {
        setEditTarget(null);
        resetForm();
        setFormData((previous) => ({
            ...previous,
            group: selectedGroup && selectedGroup !== 'all' ? String(selectedGroup) : '',
        }));
        setIsEditOpen(false);
        openAddUserAuthModal();
    }, [resetForm, openAddUserAuthModal, selectedGroup]);

    const openEditModal = useCallback((user) => {
        setEditTarget(user);
        setFormData(createEditFormState(user));
        setEditAuthPassword('');
        setIsAddOpen(false);
        setIsEditOpen(true);
    }, []);

    const closeAddModal = useCallback(() => {
        setIsAddOpen(false);
        setIsAddUserAuthOpen(false);
        resetForm();
        setAddUserAuthPassword('');
        setAddUserAuthMessage('');
    }, [resetForm]);

    const closeEditModal = useCallback(() => {
        setIsEditOpen(false);
        setEditTarget(null);
        resetForm();
        setEditAuthPassword('');
    }, [resetForm]);

    const closeGroupAuthModal = useCallback(() => {
        setIsGroupAuthOpen(false);
        setGroupAuthPassword('');
        setGroupAuthMessage('');
    }, []);

    const closeAddGroupModal = useCallback(() => {
        setIsAddGroupOpen(false);
        setGroupFormData(createInitialGroupFormState());
        setGroupEditorTab('attribute');
    }, []);

    const closeDeleteAuthModal = useCallback(() => {
        setIsDeleteAuthOpen(false);
        setDeleteAuthPassword('');
        setDeleteAuthMessage('');
        setPendingDeleteTarget(null);
    }, []);

    const openAddGroupAuthModal = useCallback(() => {
        setIsAddOpen(false);
        setIsEditOpen(false);
        setIsAddGroupOpen(false);
        setGroupFormData(createInitialGroupFormState());
        setGroupAuthPassword('');
        setGroupAuthMessage('');
        setGroupEditorTab('attribute');
        setIsGroupAuthOpen(true);
    }, []);

    const loadGroupPermissionChannels = useCallback(async () => {
        try {
            // Use cameraService to get channels with proper ChannelTitle data
            const rows = await cameraService.getCameraChannels();
            const channels = (Array.isArray(rows) ? rows : [])
                .map((row) => ({
                    id: Number(row?.id),
                    name: String(row?.name || row?.channelName || `Channel ${row?.id}`),
                }))
                .filter((ch) => Number.isFinite(ch.id) && ch.id > 0)
                .sort((left, right) => left.id - right.id);

            setGroupPermissionChannels(channels);
        } catch {
            setGroupPermissionChannels([]);
        }
    }, []);

    const confirmGroupAuth = useCallback(async (event) => {
        event.preventDefault();
        if (!String(groupAuthPassword || '').trim()) {
            setGroupAuthMessage('Password autentikasi wajib diisi.');
            return;
        }

        setGroupAuthMessage('');
        try {
            const probe = await loginWithDigest(currentUsername, String(groupAuthPassword || ''));
            if (probe && probe.requiresDigest === false) {
                setGroupAuthMessage('Perangkat tidak dapat memverifikasi kredensial melalui endpoint probe. Operasi dibatalkan.');
                return;
            }

            await loadGroupPermissionChannels();
            setIsGroupAuthOpen(false);
            setIsAddGroupOpen(true);
        } catch (error) {
            const serverMessage =
                (error?.response && (typeof error.response.data === 'string' ? error.response.data : error.response.data?.message))
                || error?.message
                || 'Gagal memuat permission. Periksa password autentikasi.';
            setGroupAuthMessage(String(serverMessage));
        }
    }, [currentUsername, groupAuthPassword, loadGroupPermissionChannels]);

    const handleAddGroup = useCallback(async (event) => {
        event.preventDefault();

        const groupName = String(groupFormData.name || '').trim();
        if (!groupName) {
            setStatusMessage('Nama group wajib diisi.');
            return;
        }

        const selectedAuthorities = String(groupFormData.authority || '')
            .split(',')
            .map((entry) => String(entry || '').trim())
            .filter(Boolean);
        if (selectedAuthorities.length === 0) {
            setStatusMessage('Pilih minimal satu permission sebelum menambahkan group.');
            return;
        }

        if (!String(groupAuthPassword || '').trim()) {
            setGroupAuthMessage('Password autentikasi wajib diisi.');
            setIsAddGroupOpen(false);
            setIsGroupAuthOpen(true);
            return;
        }

        try {
            setSubmitting(true);
            setGroupAuthMessage('');

            // Pre-check manager credentials using existing digest login probe.
            try {
                const probe = await loginWithDigest(currentUsername, String(groupAuthPassword || ''));
                // If probe reports that the probe endpoint does NOT require digest, we cannot
                // reliably validate manager credentials using the configured probe.
                if (probe && probe.requiresDigest === false) {
                    setGroupAuthMessage('Perangkat tidak dapat memverifikasi kredensial melalui endpoint probe. Operasi dibatalkan.');
                    setSubmitting(false);
                    return;
                }
            } catch (authErr) {
                const authMessage = (authErr && authErr.message) ? String(authErr.message) : 'Kredensial manager salah.';
                setGroupAuthMessage(authMessage);
                setSubmitting(false);
                return;
            }

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
        } catch (error) {
            const serverMessage =
                (error?.response && (typeof error.response.data === 'string' ? error.response.data : error.response.data?.message))
                || error?.message
                || 'Gagal menambahkan group. Periksa password autentikasi dan parameter group.';
            setStatusMessage(String(serverMessage));
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
                payload: {
                    name: formData.name,
                    password: formData.password,
                    group: formData.group,
                    remark: formData.remark,
                    sharable: formData.sharable,
                    reserved: formData.reserved,
                    needModPwd: formData.needModPwd,
                },
                extraQuery: formData.extraQuery,
            });
            closeAddModal();
            await loadAllUsers();
            setStatusMessage('User berhasil ditambahkan.');
            setAddEditNotification({
                type: 'success',
                title: 'User Ditambahkan',
                message: `User "${formData.name}" telah berhasil ditambahkan.`,
            });
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
            const successMessage = shouldModifyPassword ? 'User dan password berhasil diperbarui.' : 'User berhasil diperbarui.';
            setStatusMessage(successMessage);
            setAddEditNotification({
                type: 'success',
                title: 'User Diperbarui',
                message: `User "${formData.name}" telah berhasil diperbarui.`,
            });
        } catch {
            setStatusMessage('Gagal memperbarui user. Pastikan query parameter sesuai kebutuhan perangkat.');
        } finally {
            setSubmitting(false);
        }
    }, [closeEditModal, formData, loadAllUsers]);

    const handleModifyUserDescription = useCallback(async ({ user, remark = '' }) => {
        const username = String(user?.name || '').trim();
        if (!username || username === '-') {
            setStatusMessage('Nama user tidak valid.');
            return false;
        }

        try {
            setSubmitting(true);
            setStatusMessage('');

            await userService.modifyUser({
                payload: {
                    name: username,
                    group: String(user?.group || '').trim(),
                    authority: Array.isArray(user?.authorities) ? user.authorities.join(',') : String(user?.authority || '').trim(),
                    remark: String(remark || '').trim(),
                    sharable: user?.raw?.Sharable !== undefined ? String(user.raw.Sharable).toLowerCase() === 'true' : true,
                    reserved: user?.raw?.Reserved !== undefined ? String(user.raw.Reserved).toLowerCase() === 'true' : false,
                    needModPwd: user?.raw?.NeedModPwd !== undefined ? String(user.raw.NeedModPwd).toLowerCase() === 'true' : false,
                },
                extraQuery: '',
            });

            await loadAllUsers();
            setStatusMessage('Description user berhasil diperbarui.');
            setAddEditNotification({
                type: 'success',
                title: 'User Diperbarui',
                message: `Description user "${username}" telah berhasil diperbarui.`,
            });
            return true;
        } catch {
            setStatusMessage('Gagal memperbarui description user.');
            return false;
        } finally {
            setSubmitting(false);
        }
    }, [loadAllUsers]);

    // Manager-based password modification removed. Use `handleModifyOwnPassword` for self password changes.

    const handleModifyOwnPassword = useCallback(async ({ user, oldPassword = '', newPassword = '' }) => {
        const username = String(user?.name || '').trim();
        if (!username || username === '-') {
            setStatusMessage('Nama user tidak valid.');
            return { success: false, message: 'Nama user tidak valid.' };
        }

        if (!String(oldPassword || '').trim() || !String(newPassword || '').trim()) {
            setStatusMessage('Old password dan new password wajib diisi.');
            return { success: false, message: 'Old password dan new password wajib diisi.' };
        }

        try {
            setSubmitting(true);
            setStatusMessage('');

            await userService.modifyPassword({
                name: username,
                pwd: String(newPassword || '').trim(),
                pwdOld: String(oldPassword || '').trim(),
                extraQuery: '',
            });

            await loadAllUsers();
            setStatusMessage('Password berhasil diperbarui.');
            return { success: true, message: 'Password berhasil diperbarui.' };
        } catch (error) {
            const message = getSelfPasswordChangeErrorMessage(error);
            setStatusMessage(message);
            return {
                success: false,
                message,
                kind: message === 'Old password salah.' ? 'old-password' : message === 'Password terlalu lemah.' ? 'weak-password' : 'general',
            };
        } finally {
            setSubmitting(false);
        }
    }, [loadAllUsers]);

    const verifyActiveUserPassword = useCallback(async ({ password = '' }) => {
        const authPassword = String(password || '').trim();
        if (!authPassword) {
            setStatusMessage('Password autentikasi wajib diisi.');
            return false;
        }

        try {
            const probe = await loginWithDigest(currentUsername, authPassword);
            if (probe && probe.requiresDigest === false) {
                setStatusMessage('Perangkat tidak dapat memverifikasi kredensial melalui endpoint probe.');
                return false;
            }
            return true;
        } catch {
            setStatusMessage('Password autentikasi salah.');
            return false;
        }
    }, [currentUsername]);

    

    const handleDeleteUser = useCallback(async ({ user, authPassword = '' }) => {
        const username = String(user?.name || '').trim();
        if (!username || username === '-') {
            setDeleteAuthMessage('Nama user tidak valid untuk dihapus.');
            return;
        }

        if (!String(authPassword || '').trim()) {
            setDeleteAuthMessage('Password autentikasi wajib diisi.');
            return;
        }

        try {
            setSubmitting(true);
            setDeleteAuthMessage('');
            await userService.deleteUser({ name: username, authPassword });
            await loadAllUsers();
            setDeleteAuthMessage('');
            setDeleteNotification({
                type: 'success',
                title: 'User Dihapus',
                message: `User "${username}" telah berhasil dihapus.`,
            });
        } catch {
            setDeleteAuthMessage('Gagal menghapus user dari perangkat. Pastikan password autentikasi benar.');
        } finally {
            setSubmitting(false);
        }
    }, [loadAllUsers]);

    const canDeleteUser = useCallback((user) => {
        const username = String(user?.name || '').trim();
        if (!username || username === '-') {
            return false;
        }

        const owner = detectOwnerFromPayload(user?.raw || {});
        const normalizedOwner = normalizeSearch(owner);
        const normalizedCurrent = normalizeSearch(currentUsername);
        if (!normalizedCurrent) {
            return false;
        }

        const normalizedUser = normalizeSearch(username);
        const protectedUsers = new Set(['admin', 'administrator', 'onvif', 'evosecure']);
        const isProtectedTarget = protectedUsers.has(normalizedUser);
        const isOwnerMatch = Boolean(normalizedOwner) && normalizedOwner === normalizedCurrent;
        const canFallbackDelete = !normalizedOwner && !isProtectedTarget;

        return isOwnerMatch || canFallbackDelete;
    }, [currentUsername]);

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
            setDeleteAuthMessage('Group hanya bisa dihapus jika kosong.');
            return;
        }

        if (!String(authPassword || '').trim()) {
            setDeleteAuthMessage('Password autentikasi wajib diisi.');
            return;
        }

        try {
            setSubmitting(true);
            setDeleteAuthMessage('');
            await userService.deleteGroup({ name: groupName, authPassword });
            await loadAllUsers();
            setDeleteAuthMessage('');
            setDeleteNotification({
                type: 'success',
                title: 'Group Dihapus',
                message: `Group "${groupName}" telah berhasil dihapus.`,
            });
        } catch {
            setDeleteAuthMessage('Gagal menghapus group. Pastikan group kosong dan password autentikasi benar.');
        } finally {
            setSubmitting(false);
        }
    }, [canDeleteGroup, loadAllUsers]);

    const handleModifyGroupAttribute = useCallback(async ({ group, nextName = '', memo = '', authPassword = '' }) => {
        const groupName = String(group?.groupName || '').trim();
        if (!groupName || groupName.toLowerCase() === 'all') {
            setStatusMessage('Group tidak valid untuk diubah.');
            return false;
        }
        const targetName = String(nextName || groupName).trim();
        if (!targetName) {
            setStatusMessage('Nama group baru tidak valid.');
            return false;
        }

        const password = String(authPassword || '').trim();
        if (!password) {
            setStatusMessage('Password autentikasi wajib diisi.');
            return false;
        }

        const authorities = Array.isArray(group?.raw?.AuthorityList)
            ? group.raw.AuthorityList.map((entry) => String(entry || '').trim()).filter(Boolean)
            : String(
                group?.raw?.authority
                || group?.raw?.Authority
                || group?.raw?.authorityList
                || '',
            )
                .split(',')
                .map((entry) => String(entry || '').trim())
                .filter(Boolean);

        try {
            setSubmitting(true);
            setStatusMessage('');

            const probe = await loginWithDigest(currentUsername, password);
            if (probe && probe.requiresDigest === false) {
                setStatusMessage('Perangkat tidak dapat memverifikasi kredensial melalui endpoint probe. Operasi dibatalkan.');
                return false;
            }

            await userService.modifyGroup({
                payload: {
                    name: groupName,
                    nextName: targetName,
                    memo: String(memo || '').trim(),
                    authority: authorities.join(','),
                },
                authPassword: password,
            });

            await loadAllUsers();
            setStatusMessage('Attribute group berhasil diperbarui.');
            return true;
        } catch (error) {
            const message =
                (error?.response && (typeof error.response.data === 'string' ? error.response.data : error.response.data?.message))
                || error?.message
                || 'Gagal memperbarui attribute group.';
            setStatusMessage(String(message));
            return false;
        } finally {
            setSubmitting(false);
        }
    }, [currentUsername, loadAllUsers]);

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
        setDeleteAuthMessage('');
        setIsDeleteAuthOpen(true);
    }, [canDeleteGroup]);

    const confirmDeleteAuth = useCallback(async (event) => {
        event.preventDefault();

        const authPassword = String(deleteAuthPassword || '').trim();
        if (!authPassword) {
            setDeleteAuthMessage('Password autentikasi wajib diisi.');
            return;
        }

        if (!pendingDeleteTarget) {
            setDeleteAuthMessage('Target hapus tidak ditemukan.');
            return;
        }

        try {
            const probe = await loginWithDigest(currentUsername, authPassword);
            if (probe && probe.requiresDigest === false) {
                setDeleteAuthMessage('Perangkat tidak dapat memverifikasi kredensial melalui endpoint probe. Operasi dibatalkan.');
                return;
            }

            if (pendingDeleteTarget.kind === 'user') {
                await handleDeleteUser({ user: pendingDeleteTarget.user, authPassword });
            } else if (pendingDeleteTarget.kind === 'group') {
                await handleDeleteGroup({ group: pendingDeleteTarget.group, authPassword });
            }
            closeDeleteAuthModal();
        } catch (error) {
            const message =
                (error?.response && (typeof error.response.data === 'string' ? error.response.data : error.response.data?.message))
                || error?.message
                || 'Password salah atau autentikasi gagal.';
            setDeleteAuthMessage(String(message));
        }
    }, [closeDeleteAuthModal, currentUsername, deleteAuthPassword, handleDeleteGroup, handleDeleteUser, pendingDeleteTarget]);


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
        isAddUserAuthOpen,
        formData,
        setFormData,
        groupFormData,
        setGroupFormData,
        groupAuthPassword,
        setGroupAuthPassword,
        groupAuthMessage,
            addUserAuthPassword,
            setAddUserAuthPassword,
            addUserAuthMessage,
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
        canEditSelectedAttribute,
        selectedUserForAttribute,
        setSelectedUserForAttribute,
        filteredUsers,
        loadAllUsers,
        openAddModal,
        openAddUserAuthModal,
        openAddGroupAuthModal,
        openEditModal,
        closeAddModal,
        closeAddUserAuthModal,
        confirmAddUserAuth,
        closeEditModal,
        closeGroupAuthModal,
        closeAddGroupModal,
        isDeleteAuthOpen,
        deleteAuthPassword,
        setDeleteAuthPassword,
        deleteAuthMessage,
        closeDeleteAuthModal,
        openDeleteAuthModal,
        confirmDeleteAuth,
        confirmGroupAuth,
        handleAddUser,
        handleAddGroup,
        handleModifyUser,
        handleModifyUserDescription,
        handleModifyOwnPassword,
        verifyActiveUserPassword,
        handleDeleteUser,
        canDeleteUser,
        canDeleteGroup,
        handleDeleteGroup,
        handleModifyGroupAttribute,
        selectedUserForPermission,
        setSelectedUserForPermission,
        isUserManagementSupported,
        deleteNotification,
        setDeleteNotification,
        addEditNotification,
        setAddEditNotification,

        // UI State - Password Visibility
        showDeletePassword,
        setShowDeletePassword,
        showGroupPassword,
        setShowGroupPassword,
        showUserPwdAuthPassword,
        setShowUserPwdAuthPassword,
        showUserPwdManagerPassword,
        setShowUserPwdManagerPassword,
        showUserPwdNewValue,
        setShowUserPwdNewValue,
        showUserPwdOldValue,
        setShowUserPwdOldValue,
        showUserPwdConfirmValue,
        setShowUserPwdConfirmValue,
        showAddUserAuthPassword,
        setShowAddUserAuthPassword,
        showGroupAttrAuthPassword,
        setShowGroupAttrAuthPassword,

        // UI State - Modal Control
        isUserPwdManagerOpen,
        setIsUserPwdManagerOpen,
        isUserPwdAuthOpen,
        setIsUserPwdAuthOpen,
        isGroupAttrAuthOpen,
        setIsGroupAttrAuthOpen,

        // UI State - Form Inputs
        userPwdAuthPassword,
        setUserPwdAuthPassword,
        userPwdManagerPassword,
        setUserPwdManagerPassword,
        userPwdNewValue,
        setUserPwdNewValue,
        userPwdOldValue,
        setUserPwdOldValue,
        userPwdConfirmValue,
        setUserPwdConfirmValue,
        userDescriptionDraft,
        setUserDescriptionDraft,
        userPwdAuthMode,
        setUserPwdAuthMode,
        pendingUserDescriptionApply,
        setPendingUserDescriptionApply,
        editAuthPassword,
        setEditAuthPassword,
        addUserConfirmPassword,
        setAddUserConfirmPassword,
        groupAttrName,
        setGroupAttrName,
        groupAttrMemo,
        setGroupAttrMemo,
        groupAttrAuthPassword,
        setGroupAttrAuthPassword,

        // UI State - Messages & Errors
        userPwdModalMessage,
        setUserPwdModalMessage,
        userPwdOldError,
        setUserPwdOldError,

        // UI State - Display & Pagination
        showAllChannels,
        setShowAllChannels,
        channelPage,
        setChannelPage,

        // Refs
        deletePasswordFormRef,
        groupPasswordFormRef,
        groupAttrPasswordFormRef,
    };
}
