import React from "react";
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
  Eye,
  EyeOff,
} from "lucide-react";
import { useUserManagement } from "../../../hooks/user/useUserManagement";
import PermissionManagement from "../../../components/user/PermissionManagement";

const AUTHORITY_OPTIONS = [
  { value: "AuthUserMag", label: "AuthUserMag" },
  { value: "AuthSysCfg", label: "AuthSysCfg" },
  { value: "AuthSysInfo", label: "AuthSysInfo" },
  { value: "AuthManuCtr", label: "AuthManuCtr" },
  { value: "AuthBackup", label: "AuthBackup" },
  { value: "AuthStoreCfg", label: "AuthStoreCfg" },
  { value: "AuthEventCfg", label: "AuthEventCfg" },
  { value: "AuthNetCfg", label: "AuthNetCfg" },
  { value: "AuthRmtDevice", label: "AuthRmtDevice" },
  { value: "AuthPeripheral", label: "AuthPeripheral" },
  { value: "AuthDisplay", label: "AuthDisplay" },
  { value: "AuthPTZ", label: "AuthPTZ" },
  { value: "AuthSecurity", label: "AuthSecurity" },
  { value: "AuthMaintence", label: "AuthMaintence" },
  { value: "AuthTaskMag", label: "AuthTaskMag" },
];

const GROUP_PERMISSION_SECTIONS = {
  config: {
    label: "Config",
    items: [
      { label: "System", token: "AuthSysCfg" },
      { label: "Event", token: "AuthEventCfg" },
      { label: "Account", token: "AuthUserMag" },
      { label: "Storage", token: "AuthStoreCfg" },
      { label: "Network", token: "AuthNetCfg" },
      { label: "Security", token: "AuthSecurity" },
      { label: "Camera", token: "AuthRmtDevice" },
      { label: "Peripheral", token: "AuthPeripheral" },
      { label: "PTZ", token: "AuthPTZ" },
    ],
  },
  operation: {
    label: "Operation",
    items: [
      { label: "Backup", token: "AuthBackup" },
      { label: "Maintenance", token: "AuthMaintence" },
      { label: "Device Maintenance", token: "AuthMaintence" },
      { label: "Tasks", token: "AuthTaskMag" },
    ],
  },
  control: {
    label: "Control",
    items: [{ label: "Manual Control", token: "AuthManuCtr" }],
  },
};

const CHANNELS_PER_PAGE = 20;

function getChannelToken(channelId, action) {
  const prefix = action === "live" ? "Live" : "Playback";
  return `${prefix}Channel${channelId}`;
}

function parseAuthorityValues(authorityText) {
  return String(authorityText || "")
    .split(",")
    .map((entry) => String(entry || "").trim())
    .filter(Boolean);
}

function setAuthorityValue(currentValue, token, checked) {
  const values = parseAuthorityValues(currentValue);
  const preserved = values.filter(
    (entry) => !AUTHORITY_OPTIONS.some((option) => option.value === entry),
  );
  const optionValues = new Set(
    values.filter((entry) =>
      AUTHORITY_OPTIONS.some((option) => option.value === entry),
    ),
  );

  if (checked) {
    optionValues.add(token);
  } else {
    optionValues.delete(token);
  }

  return [
    ...preserved,
    ...AUTHORITY_OPTIONS.map((option) => option.value).filter((entry) =>
      optionValues.has(entry),
    ),
  ].join(",");
}

function setAuthorityValues(currentValue, tokens, checked) {
  const values = parseAuthorityValues(currentValue);
  const preserved = values.filter((entry) => !tokens.includes(entry));
  const tokenSet = new Set(values.filter((entry) => tokens.includes(entry)));

  tokens.forEach((token) => {
    if (checked) {
      tokenSet.add(token);
    } else {
      tokenSet.delete(token);
    }
  });

  return [...preserved, ...tokens.filter((entry) => tokenSet.has(entry))].join(
    ",",
  );
}

const UserManagement = () => {
  const {
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
    submitting,
    currentUsername,
    filteredUsers,
    loadAllUsers,
    openAddModal,
    openAddGroupAuthModal,
    closeAddUserAuthModal,
    confirmAddUserAuth,
    openEditModal,
    closeAddModal,
    closeEditModal,
    closeGroupAuthModal,
    closeAddGroupModal,
    confirmGroupAuth,
    isDeleteAuthOpen,
    deleteAuthPassword,
    setDeleteAuthPassword,
    deleteAuthMessage,
    closeDeleteAuthModal,
    openDeleteAuthModal,
    confirmDeleteAuth,
    handleAddUser,
    handleAddGroup,
    handleModifyUser,
    handleModifyUserDescription,
    handleModifyOwnPassword,
    verifyActiveUserPassword,
    handleModifyGroupAttribute,
    canDeleteUser,
    canDeleteGroup,

    activeTab,
    setActiveTab,
    selectedGroup,
    setSelectedGroup,
    isTreeExpanded,
    setIsTreeExpanded,
    toggleGroupExpanded,
    isGroupExpanded,
    userGroups,
    filteredUserGroups,
    selectedGroupUsers,
    selectedGroupInfo,
    selectedAttributeInfo,
    selectedAttributeUser,
    canEditSelectedAttribute,
    selectedUserForAttribute,
    setSelectedUserForAttribute,
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
  } = useUserManagement();

  const isAttributeTab = activeTab === "attribute";
  const isUserSelected = selectedAttributeInfo.isUserNode;
  const isGroupNodeSelected = !isUserSelected && selectedGroup !== "all";
  const canShowPermissionTab =
    (isUserSelected && Boolean(selectedUserForPermission)) ||
    isGroupNodeSelected;
  const selectedGroupAuthorities = parseAuthorityValues(
    groupFormData.authority,
  );
  const canSubmitAddGroup = selectedGroupAuthorities.length > 0;
  const selectedGroupObject =
    userGroups.find((group) => group.groupName === selectedGroup) || null;
  const isUserPasswordSelfTarget =
    String(selectedAttributeUser?.name || "")
      .trim()
      .toLowerCase() ===
    String(currentUsername || "")
      .trim()
      .toLowerCase();
  const selectedGroupPermissionAuthorities = React.useMemo(() => {
    if (!selectedGroupObject) {
      return [];
    }

    const rawAuthorities =
      selectedGroupObject?.raw?.AuthorityList ||
      selectedGroupObject?.raw?.authorityList ||
      selectedGroupObject?.raw?.authority ||
      selectedGroupObject?.raw?.Authority ||
      "";

    return Array.isArray(rawAuthorities)
      ? rawAuthorities
          .map((entry) => String(entry || "").trim())
          .filter(Boolean)
      : parseAuthorityValues(rawAuthorities);
  }, [selectedGroupObject]);
  const deleteTarget =
    selectedAttributeInfo.isUserNode && selectedAttributeUser
      ? {
          kind: "user",
          label: selectedAttributeUser.name,
          canDelete: canDeleteUser(selectedAttributeUser),
          title: `Delete User: ${selectedAttributeUser.name}`,
          user: selectedAttributeUser,
        }
      : selectedGroupObject
        ? {
            kind: "group",
            label: selectedGroupObject.groupName,
            canDelete: canDeleteGroup(selectedGroupObject),
            title: canDeleteGroup(selectedGroupObject)
              ? `Delete Group: ${selectedGroupObject.groupName}`
              : "Delete Group (group must be empty)",
            group: selectedGroupObject,
          }
        : null;

  const getSectionTokens = (sectionKey) =>
    GROUP_PERMISSION_SECTIONS[sectionKey].items.map((item) => item.token);
  const areSectionTokensChecked = (sectionKey) =>
    getSectionTokens(sectionKey).every((token) =>
      selectedGroupAuthorities.includes(token),
    );
  const isChannelChecked = (token) => selectedGroupAuthorities.includes(token);

  const userPwdStrengthLevel = React.useMemo(() => {
    const password = String(userPwdNewValue || "");
    const len = password.length;

    if (len < 8) {
      return 0; // weak
    }
    if (len < 12) {
      return 1; // medium
    }
    return 2; // strong
  }, [userPwdNewValue]);

  const formDataPwdStrengthLevel = React.useMemo(() => {
    const password = String(formData.password || "");
    const len = password.length;

    if (len < 8) {
      return 0; // weak
    }
    if (len < 12) {
      return 1; // medium
    }
    return 2; // strong
  }, [formData.password]);

  React.useEffect(() => {
    if (!isAddOpen) {
      return;
    }
    if (typeof setAddUserConfirmPassword === "function") {
      setAddUserConfirmPassword("");
    } else {
      // eslint-disable-next-line no-console
      console.warn("setAddUserConfirmPassword is not a function");
    }
  }, [isAddOpen, setAddUserConfirmPassword]);

  const canEditGroupAttributeInline =
    !isUserSelected && selectedGroup !== "all" && canEditSelectedAttribute;

  const allPermissionChannels = React.useMemo(() => {
    const normalized = Array.isArray(groupPermissionChannels)
      ? [...groupPermissionChannels]
          .map((channel) => ({
            id: Number(channel?.id),
            name: String(channel?.name || "").trim(),
          }))
          .filter((channel) => Number.isFinite(channel.id) && channel.id > 0)
          .sort((left, right) => left.id - right.id)
      : [];

    if (!showAllChannels) {
      return normalized;
    }

    const maxExistingId = normalized.reduce(
      (max, channel) => Math.max(max, channel.id),
      0,
    );
    const targetCount = Math.max(maxExistingId, 64);
    const byId = new Map(normalized.map((channel) => [channel.id, channel]));

    return Array.from({ length: targetCount }, (_, index) => {
      const id = index + 1;
      const existing = byId.get(id);
      return {
        id,
        name: existing?.name || `Channel${id}`,
      };
    });
  }, [groupPermissionChannels, showAllChannels]);

  const channelTotalPages = Math.max(
    1,
    Math.ceil(allPermissionChannels.length / CHANNELS_PER_PAGE),
  );

  const pagedPermissionChannels = React.useMemo(() => {
    const startIndex = (channelPage - 1) * CHANNELS_PER_PAGE;
    const endIndex = startIndex + CHANNELS_PER_PAGE;
    return allPermissionChannels.slice(startIndex, endIndex);
  }, [allPermissionChannels, channelPage]);

  const channelPageNumbers = React.useMemo(
    () => Array.from({ length: channelTotalPages }, (_, index) => index + 1),
    [channelTotalPages],
  );

  React.useEffect(() => {
    setChannelPage(1);
  }, [showAllChannels]);

  React.useEffect(() => {
    if (channelPage > channelTotalPages) {
      setChannelPage(channelTotalPages);
    }
  }, [channelPage, channelTotalPages]);

  React.useEffect(() => {
    if (!isDeleteAuthOpen) {
      setShowDeletePassword(false);
      return;
    }

    if (deletePasswordFormRef.current) {
      deletePasswordFormRef.current.reset();
    }

    setDeleteAuthPassword("");

    const timeoutId = setTimeout(() => {
      if (deletePasswordFormRef.current) {
        const passwordInput = deletePasswordFormRef.current.querySelector(
          'input[type="password"], input[type="text"][placeholder="password"]',
        );
        if (passwordInput) {
          passwordInput.value = "";
          setDeleteAuthPassword("");
        }
      }
    }, 0);

    return () => clearTimeout(timeoutId);
  }, [isDeleteAuthOpen]);

  React.useEffect(() => {
    if (!isUserPwdManagerOpen) {
      return;
    }

    if (statusMessage) {
      setUserPwdModalMessage(String(statusMessage));
    }
  }, [isUserPwdManagerOpen, statusMessage]);

  React.useEffect(() => {
    if (userPwdOldError && userPwdOldValue) {
      setUserPwdOldError("");
    }
  }, [userPwdOldError, userPwdOldValue]);

  React.useEffect(() => {
    if (!deleteNotification) {
      return;
    }

    const timeoutId = setTimeout(() => {
      setDeleteNotification(null);
    }, 3000);

    return () => clearTimeout(timeoutId);
  }, [deleteNotification, setDeleteNotification]);

  React.useEffect(() => {
    if (!addEditNotification) {
      return;
    }

    const timeoutId = setTimeout(() => {
      setAddEditNotification(null);
    }, 3000);

    return () => clearTimeout(timeoutId);
  }, [addEditNotification, setAddEditNotification]);

  React.useEffect(() => {
    if (!isGroupAuthOpen) {
      setShowGroupPassword(false);
      return;
    }

    if (groupPasswordFormRef.current) {
      groupPasswordFormRef.current.reset();
    }

    setGroupAuthPassword("");

    const timeoutId = setTimeout(() => {
      if (groupPasswordFormRef.current) {
        const passwordInput = groupPasswordFormRef.current.querySelector(
          'input[type="password"], input[type="text"][placeholder="password"]',
        );
        if (passwordInput) {
          passwordInput.value = "";
          setGroupAuthPassword("");
        }
      }
    }, 0);

    return () => clearTimeout(timeoutId);
  }, [isGroupAuthOpen]);

  React.useEffect(() => {
    if (isGroupAuthOpen || isDeleteAuthOpen || isAddUserAuthOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }

    return () => {
      document.body.style.overflow = "";
    };
  }, [isGroupAuthOpen, isDeleteAuthOpen, isAddUserAuthOpen]);

  React.useEffect(() => {
    if (!selectedAttributeInfo.isUserNode || !selectedAttributeUser) {
      setUserDescriptionDraft("");
      return;
    }
    setUserDescriptionDraft(
      String(
        selectedAttributeUser?.remark ||
          `${selectedAttributeUser?.name}'s account`,
      ),
    );
  }, [selectedAttributeInfo.isUserNode, selectedAttributeUser]);

  React.useEffect(() => {
    if (!canEditGroupAttributeInline) {
      return;
    }
    const initialMemo = String(
      selectedGroupObject?.memo ||
        selectedGroupObject?.raw?.Memo ||
        selectedGroupObject?.raw?.memo ||
        "",
    );
    setGroupAttrName(String(selectedGroupObject?.groupName || ""));
    setGroupAttrMemo(initialMemo);
  }, [canEditGroupAttributeInline, selectedGroupObject]);

  return (
    <div className="space-y-6 duration-500 animate-in fade-in md:space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-lg font-black tracking-tight text-navy md:text-2xl">
            USER MANAGEMENT
          </h2>
          <p className="mt-1 text-xs font-semibold tracking-wide text-navy/40">
            Struktur grup dan daftar user mengikuti pola panel seperti contoh.
          </p>
        </div>

        <div className="flex items-center w-full gap-2 lg:w-auto">
          <div className="relative w-full lg:w-72">
            <Search
              size={16}
              className="absolute -translate-y-1/2 left-4 top-1/2 text-navy/30"
            />
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
            className="inline-flex items-center justify-center transition-colors bg-white border w-11 h-11 rounded-xl border-navy/5 text-navy/50 hover:text-navy"
            title="Refresh"
          >
            <RefreshCw size={18} />
          </button>
          <div className="flex items-center gap-2 p-2 bg-white border shadow-sm rounded-2xl border-navy/10">
            <button
              type="button"
              onClick={openAddGroupAuthModal}
              disabled={
                !isUserManagementSupported ||
                !isTreeExpanded ||
                selectedGroup !== "all"
              }
              className="inline-flex items-center justify-center w-10 h-10 transition-colors border group rounded-xl border-navy/10 text-navy/70 hover:bg-navy/5 hover:text-navy disabled:cursor-not-allowed disabled:opacity-40"
              title={
                !isTreeExpanded
                  ? "Expand EvoSecure first"
                  : selectedGroup !== "all"
                    ? "View all groups to add"
                    : "Add Group"
              }
              aria-label="Add Group"
            >
              <Shield size={16} />
            </button>
            <button
              type="button"
              onClick={openAddModal}
              disabled={!isUserManagementSupported || selectedGroup === "all"}
              className="inline-flex items-center justify-center w-10 h-10 text-white transition-colors border group rounded-xl border-navy/10 bg-navy hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              title={
                selectedGroup === "all"
                  ? "Select a group to add user"
                  : "Add User"
              }
              aria-label="Add User"
            >
              <UserPlus size={16} />
            </button>
            <button
              type="button"
              onClick={() =>
                deleteTarget?.canDelete && openDeleteAuthModal(deleteTarget)
              }
              disabled={!deleteTarget?.canDelete}
              className="inline-flex items-center justify-center w-10 h-10 transition-colors border group rounded-xl border-danger/20 text-danger hover:bg-danger/5 disabled:cursor-not-allowed disabled:opacity-40"
              title={deleteTarget?.title || "Delete"}
              aria-label={deleteTarget?.title || "Delete"}
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>
      </div>

      {(error || statusMessage) && (
        <div
          className={`rounded-2xl border p-4 text-xs font-bold ${error ? "border-danger/20 bg-danger/10 text-danger" : "border-navy/10 bg-background text-navy/70"}`}
        >
          {error || statusMessage}
        </div>
      )}

      {!isUserManagementSupported && (
        <div className="p-4 text-xs font-bold border rounded-2xl border-amber-200 bg-amber-50 text-amber-800">
          ⚠️ Perangkat tidak mendukung penambahan atau perubahan user. Fitur Add
          User dan Edit User telah dinonaktifkan.
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
                <p className="text-xs font-black uppercase tracking-[0.22em] text-navy">
                  EvoSecure
                </p>
                <p className="text-[10px] font-bold uppercase tracking-widest text-navy/30">
                  Tree View
                </p>
              </div>
            </div>
          </div>

          <div className="p-3">
            <button
              type="button"
              onClick={() => {
                setSelectedGroup("all");
                setSelectedUserForAttribute(null);
                setSelectedUserForPermission(null);
                setActiveTab("attribute");

                setIsTreeExpanded((prev) => !prev);
              }}
              className={`flex w-full items-center justify-between rounded-2xl px-3 py-3 text-left transition-colors border ${isTreeExpanded ? "border-navy/80 bg-navy/5 text-navy" : "border-navy/15 bg-white text-navy/60 hover:bg-navy/5 hover:text-navy"}`}
            >
              <span className="flex items-center gap-3">
                {isTreeExpanded ? (
                  <ChevronDown size={16} />
                ) : (
                  <ChevronRight size={16} />
                )}
                <span className="text-xs font-black tracking-widest uppercase">
                  EvoSecure
                </span>
              </span>
              <span className="rounded-full bg-white px-2 py-1 text-[10px] font-black text-navy/40 shadow-sm">
                {filteredUsers.length}
              </span>
            </button>

            {isTreeExpanded && (
              <div className="pl-4 mt-2 space-y-2">
                {(searchTerm.trim() ? filteredUserGroups : userGroups).map((group) => {
                  const isActiveGroup = selectedGroup === group.groupName;
                  const isOpen = isGroupExpanded(group.groupName);

                  return (
                    <div
                      key={group.groupName}
                      className="p-2 border rounded-2xl border-navy/5 bg-background/60"
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedGroup(group.groupName);
                          setSelectedUserForAttribute(null);
                          setSelectedUserForPermission(null);
                          toggleGroupExpanded(group.groupName);
                          setActiveTab("attribute");
                        }}
                        className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left transition-colors ${isActiveGroup ? "bg-white text-navy shadow-sm" : "text-navy/60 hover:bg-white hover:text-navy"}`}
                      >
                        <span className="flex items-center gap-2">
                          {isOpen ? (
                            <ChevronDown size={14} />
                          ) : (
                            <ChevronRight size={14} />
                          )}
                          <span className="text-xs font-black tracking-widest uppercase">
                            {group.groupName}
                          </span>
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
                              onClick={() => {
                                setSelectedGroup(group.groupName);
                                setSelectedUserForAttribute(user.name);
                                setSelectedUserForPermission(user.name);
                                setActiveTab("attribute");
                              }}
                              className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left transition-colors ${selectedUserForAttribute === user.name ? "bg-white text-navy shadow-sm" : "text-navy/45 hover:bg-white hover:text-navy"}`}
                            >
                              <span className="flex items-center gap-2">
                                <Users size={14} />
                                <span className="text-[11px] font-bold">
                                  {user.name}
                                </span>
                              </span>
                              <span className="text-[10px] font-bold uppercase tracking-widest text-navy/25">
                                View
                              </span>
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
              onClick={() => setActiveTab("attribute")}
              className={`border-b-2 px-1 py-3 text-sm font-bold transition-colors ${isAttributeTab ? "border-navy text-navy" : "border-transparent text-navy/40 hover:text-navy/60"}`}
            >
              Attribute
            </button>
            {canShowPermissionTab && (
              <button
                type="button"
                onClick={() => setActiveTab("permission")}
                className={`border-b-2 px-1 py-3 text-sm font-bold transition-colors ${!isAttributeTab ? "border-navy text-navy" : "border-transparent text-navy/40 hover:text-navy/60"}`}
              >
                Permission
              </button>
            )}
          </div>

          <div className="p-4 md:p-6">
            {isAttributeTab ? (
              <div className="space-y-6">
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1fr]">
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-[120px_1fr] md:items-center">
                      <label className="text-sm font-medium text-navy/80">
                        Name
                      </label>
                      <input
                        type="text"
                        value={
                          canEditGroupAttributeInline
                            ? groupAttrName
                            : selectedAttributeInfo.name
                        }
                        readOnly={!canEditGroupAttributeInline}
                        onChange={(event) =>
                          setGroupAttrName(event.target.value)
                        }
                        className="w-full px-4 py-2 text-sm font-medium border rounded-md outline-none border-navy/10 bg-background text-navy"
                      />
                    </div>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-[120px_1fr] md:items-center">
                      <label className="text-sm font-medium text-navy/80">
                        Parent Node
                      </label>
                      <input
                        type="text"
                        value={selectedAttributeInfo.parent}
                        readOnly
                        className="w-full px-4 py-2 text-sm font-medium border rounded-md outline-none border-navy/10 bg-background text-navy"
                      />
                    </div>
                    {selectedAttributeInfo.isUserNode && (
                      <div className="grid grid-cols-1 gap-3 md:grid-cols-[120px_1fr] md:items-center">
                        <label className="text-sm font-medium text-navy/80">
                          Password
                        </label>
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={selectedAttributeInfo.password}
                              readOnly
                              className="w-full px-4 py-2 font-mono text-sm font-medium border rounded-md outline-none border-navy/10 bg-background text-navy"
                            />
                          </div>
                          <div className="h-1 overflow-hidden rounded bg-navy/10">
                            <div className="w-3/4 h-full bg-emerald-500" />
                          </div>
                        </div>
                      </div>
                    )}
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-[120px_1fr] md:items-start">
                      <label className="pt-2 text-sm font-medium text-navy/80">
                        Description
                      </label>
                      <textarea
                        value={
                          selectedAttributeInfo.isUserNode
                            ? userDescriptionDraft
                            : canEditGroupAttributeInline
                              ? groupAttrMemo
                              : selectedAttributeInfo.description
                        }
                        readOnly={
                          !selectedAttributeInfo.isUserNode &&
                          !canEditGroupAttributeInline
                        }
                        onChange={(event) => {
                          if (selectedAttributeInfo.isUserNode) {
                            setUserDescriptionDraft(event.target.value);
                          } else {
                            setGroupAttrMemo(event.target.value);
                          }
                        }}
                        rows={3}
                        className="w-full px-4 py-2 text-sm font-medium border rounded-md outline-none border-navy/10 bg-background text-navy"
                      />
                    </div>
                    {selectedAttributeInfo.isUserNode &&
                      canEditSelectedAttribute && (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={async () => {
                              if (!selectedAttributeUser) {
                                return;
                              }
                              setUserPwdAuthMode("applyDescription");
                              setPendingUserDescriptionApply({
                                user: selectedAttributeUser,
                                remark: userDescriptionDraft,
                              });
                              setUserPwdAuthPassword("");
                              setShowUserPwdAuthPassword(false);
                              setUserPwdModalMessage("");
                              setUserPwdOldError("");
                              setIsUserPwdAuthOpen(true);
                            }}
                            disabled={
                              !isUserManagementSupported ||
                              submitting ||
                              userDescriptionDraft ===
                                String(
                                  selectedAttributeUser?.remark ||
                                    `${selectedAttributeUser?.name}'s account`,
                                )
                            }
                            className="inline-flex items-center gap-1 rounded-md bg-navy px-3 py-2 text-[10px] font-black uppercase tracking-wider text-white disabled:opacity-50"
                            title="Apply description user"
                          >
                            Apply
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setUserDescriptionDraft(
                                String(
                                  selectedAttributeUser?.remark ||
                                    `${selectedAttributeUser?.name}'s account`,
                                ),
                              )
                            }
                            disabled={submitting}
                            className="inline-flex items-center gap-1 rounded-md border border-navy/10 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-navy/70 hover:bg-navy/5 disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Refresh description user"
                          >
                            Refresh
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setUserPwdAuthPassword("");
                              setShowUserPwdAuthPassword(false);
                              setUserPwdManagerPassword("");
                              setShowUserPwdManagerPassword(false);
                              setUserPwdOldValue("");
                              setUserPwdNewValue("");
                              setUserPwdConfirmValue("");
                              setUserPwdModalMessage("");
                              setUserPwdOldError("");
                              setShowUserPwdNewValue(false);
                              setShowUserPwdOldValue(false);
                              setShowUserPwdConfirmValue(false);
                              setIsUserPwdAuthOpen(true);
                            }}
                            disabled={submitting}
                            className="inline-flex items-center gap-1 rounded-md border border-navy/10 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-navy/70 hover:bg-navy/5 disabled:opacity-50"
                            title="Change password by manager"
                          >
                            Change Password
                          </button>
                        </div>
                      )}
                    {!selectedAttributeInfo.isUserNode &&
                      selectedGroup !== "all" &&
                      canEditSelectedAttribute && (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setGroupAttrAuthPassword("");
                              setShowGroupAttrAuthPassword(false);
                              setIsGroupAttrAuthOpen(true);
                            }}
                            disabled={!isUserManagementSupported || submitting}
                            className="inline-flex items-center gap-1 rounded-md bg-navy px-3 py-2 text-[10px] font-black uppercase tracking-wider text-white disabled:opacity-50"
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const initialMemo = String(
                                selectedGroupObject?.memo ||
                                  selectedGroupObject?.raw?.Memo ||
                                  selectedGroupObject?.raw?.memo ||
                                  "",
                              );
                              setGroupAttrName(
                                String(selectedGroupObject?.groupName || ""),
                              );
                              setGroupAttrMemo(initialMemo);
                            }}
                            className="inline-flex items-center gap-1 rounded-md border border-navy/10 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-navy/70 hover:bg-navy/5"
                          >
                            Cancel
                          </button>
                        </div>
                      )}
                  </div>
                </div>

                {!selectedAttributeInfo.isUserNode &&
                  selectedGroup === "all" && (
                    <div className="overflow-hidden border rounded-2xl border-navy/5">
                      <div className="px-4 py-3 border-b border-navy/5 md:px-5">
                        <h3 className="text-sm font-medium text-navy/80">
                          Group List
                        </h3>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[560px] border-collapse text-left">
                          <thead>
                            <tr className="text-sm font-semibold bg-background/60 text-navy/60">
                              <th className="px-4 py-3 text-center border-b border-navy/5">
                                Group
                              </th>
                              <th className="px-4 py-3 text-center border-b border-navy/5">
                                Total User
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {userGroups.map((group) => (
                              <tr
                                key={group.groupName}
                                className="text-sm text-navy/80"
                              >
                                <td className="px-4 py-4 font-medium text-center border-b border-navy/5">
                                  {group.groupName}
                                </td>
                                <td className="px-4 py-4 font-medium text-center border-b border-navy/5">
                                  {group.users.length}
                                </td>
                              </tr>
                            ))}
                            {userGroups.length === 0 && (
                              <tr>
                                <td
                                  className="px-4 py-8 text-sm text-center text-navy/30"
                                  colSpan={2}
                                >
                                  Tidak ada group yang tersedia.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                {!selectedAttributeInfo.isUserNode &&
                  selectedGroup !== "all" && (
                    <div className="overflow-hidden border rounded-2xl border-navy/5">
                      <div className="px-4 py-3 border-b border-navy/5 md:px-5">
                        <h3 className="text-sm font-medium text-navy/80">
                          User List
                        </h3>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[720px] border-collapse text-left">
                          <thead>
                            <tr className="text-sm font-semibold bg-background/60 text-navy/60">
                              <th className="px-4 py-3 text-center border-b border-navy/5">
                                Username
                              </th>
                              <th className="px-4 py-3 text-center border-b border-navy/5">
                                Password
                              </th>
                              <th className="px-4 py-3 text-center border-b border-navy/5">
                                Description
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {selectedGroupUsers.map((user) => (
                              <tr
                                key={`${user.name}-${user.group}`}
                                className="text-sm text-navy/80"
                              >
                                <td className="px-4 py-4 font-medium text-center border-b border-navy/5">
                                  {user.name}
                                </td>
                                <td className="px-4 py-4 font-medium text-center border-b border-navy/5">
                                  Strong
                                </td>
                                <td className="px-4 py-4 font-medium text-center border-b border-navy/5">
                                  {user.remark || `${user.name}'s account`}
                                </td>
                              </tr>
                            ))}
                            {selectedGroupUsers.length === 0 && (
                              <tr>
                                <td
                                  className="px-4 py-8 text-sm text-center text-navy/30"
                                  colSpan={3}
                                >
                                  Tidak ada user pada group ini.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
              </div>
            ) : (
              <PermissionManagement
                userName={
                  selectedGroup === "onvif" || !isUserSelected
                    ? ""
                    : selectedUserForPermission
                }
                groupName={
                  !isUserSelected && selectedGroup !== "all"
                    ? selectedGroup
                    : ""
                }
                authoritiesOverride={
                  !isUserSelected && selectedGroup !== "all"
                    ? selectedGroupPermissionAuthorities
                    : []
                }
              />
            )}
          </div>
        </section>
      </div>

      {(loading || submitting) && (
        <div className="p-4 text-center bg-white border shadow-sm rounded-2xl border-navy/5">
          <div className="inline-flex items-center gap-2 text-xs font-bold text-navy/50">
            <Loader2 size={16} className="animate-spin" />
            {loading ? "Memuat data user..." : "Menyimpan perubahan..."}
          </div>
        </div>
      )}

      {isAddUserAuthOpen && (
        <div className="fixed top-[-40px] left-0 right-0 bottom-0 z-[100] min-h-screen w-screen flex items-center justify-center bg-navy/30 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl p-6 bg-white border shadow-2xl rounded-3xl border-navy/10 md:p-8">
            <h3 className="mb-2 text-sm font-black tracking-widest uppercase text-navy">
              Authentication Password
            </h3>
            <p className="mb-6 text-[11px] font-semibold text-navy/50">
              Masukkan password akun aktif sebelum menambahkan user baru.
            </p>

            {addUserAuthMessage && (
              <div className="mb-4 rounded-2xl border border-danger/20 bg-danger/10 px-4 py-3 text-[11px] font-bold text-danger">
                {addUserAuthMessage}
              </div>
            )}

            <form
              onSubmit={confirmAddUserAuth}
              className="space-y-4"
              autoComplete="off"
              noValidate
            >
              <input
                type="text"
                value={currentUsername}
                readOnly
                className="w-full px-4 py-2 text-xs font-bold border outline-none rounded-xl border-navy/10 bg-background text-navy/60"
                placeholder="username"
                autoComplete="off"
              />
              <div className="relative">
                <input
                  key={isAddUserAuthOpen ? "open" : "closed"}
                  type={showAddUserAuthPassword ? "text" : "password"}
                  value={addUserAuthPassword}
                  onChange={(event) =>
                    setAddUserAuthPassword(event.target.value)
                  }
                  placeholder="password"
                  className="w-full px-4 py-2 pr-10 text-xs font-bold border outline-none rounded-xl border-navy/10 bg-background text-navy focus:border-navy/30"
                  required
                  autoFocus
                  autoComplete="new-password"
                  name="auth_adduser_pass"
                  data-lpignore="true"
                  data-1p-ignore="true"
                  spellCheck="false"
                />
                <button
                  type="button"
                  onClick={() =>
                    setShowAddUserAuthPassword(!showAddUserAuthPassword)
                  }
                  className="absolute transition-colors transform -translate-y-1/2 right-3 top-1/2 text-navy/50 hover:text-navy/70"
                  tabIndex={-1}
                  title={
                    showAddUserAuthPassword ? "Hide password" : "Show password"
                  }
                >
                  {showAddUserAuthPassword ? (
                    <EyeOff size={16} />
                  ) : (
                    <Eye size={16} />
                  )}
                </button>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeAddUserAuthModal}
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
                  OK
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isGroupAuthOpen && (
        <div className="fixed top-[-40px] left-0 right-0 bottom-0 z-[100] min-h-screen w-screen flex items-center justify-center bg-navy/30 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl p-6 bg-white border shadow-2xl rounded-3xl border-navy/10 md:p-8">
            <h3 className="mb-2 text-sm font-black tracking-widest uppercase text-navy">
              Authentication Password
            </h3>
            <p className="mb-6 text-[11px] font-semibold text-navy/50">
              Masukkan password akun aktif sebelum menambahkan group baru.
            </p>

            {groupAuthMessage && (
              <div className="mb-4 rounded-2xl border border-danger/20 bg-danger/10 px-4 py-3 text-[11px] font-bold text-danger">
                {groupAuthMessage}
              </div>
            )}

            <form
              ref={groupPasswordFormRef}
              onSubmit={confirmGroupAuth}
              className="space-y-4"
              autoComplete="off"
              noValidate
            >
              <input
                type="text"
                value={currentUsername}
                readOnly
                className="w-full px-4 py-2 text-xs font-bold border outline-none rounded-xl border-navy/10 bg-background text-navy/60"
                placeholder="username"
                autoComplete="off"
              />
              <div className="relative">
                <input
                  key={isGroupAuthOpen ? "open" : "closed"}
                  type={showGroupPassword ? "text" : "password"}
                  value={groupAuthPassword}
                  onChange={(event) => setGroupAuthPassword(event.target.value)}
                  placeholder="password"
                  className="w-full px-4 py-2 pr-10 text-xs font-bold border outline-none rounded-xl border-navy/10 bg-background text-navy focus:border-navy/30"
                  required
                  autoFocus
                  autoComplete="new-password"
                  name="auth_group_pass"
                  data-lpignore="true"
                  data-1p-ignore="true"
                  spellCheck="false"
                />
                <button
                  type="button"
                  onClick={() => setShowGroupPassword(!showGroupPassword)}
                  className="absolute transition-colors transform -translate-y-1/2 right-3 top-1/2 text-navy/50 hover:text-navy/70"
                  tabIndex={-1}
                  title={showGroupPassword ? "Hide password" : "Show password"}
                >
                  {showGroupPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeGroupAuthModal}
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
                  OK
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isGroupAttrAuthOpen && (
        <div className="fixed top-[-40px] left-0 right-0 bottom-0 z-[120] min-h-screen w-screen flex items-center justify-center bg-navy/30 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl p-6 bg-white border shadow-2xl rounded-3xl border-navy/10 md:p-8">
            <h3 className="mb-2 text-sm font-black tracking-widest uppercase text-navy">
              Authentication Password
            </h3>
            <p className="mb-6 text-[11px] font-semibold text-navy/50">
              Masukkan password akun aktif untuk menyimpan perubahan attribute.
            </p>
            <form
              ref={groupAttrPasswordFormRef}
              onSubmit={async (event) => {
                event.preventDefault();
                if (!selectedGroupObject) {
                  return;
                }
                const updated = await handleModifyGroupAttribute({
                  group: selectedGroupObject,
                  nextName: groupAttrName,
                  memo: groupAttrMemo,
                  authPassword: groupAttrAuthPassword,
                });
                if (updated) {
                  setIsGroupAttrAuthOpen(false);
                }
              }}
              className="space-y-4"
              autoComplete="off"
              noValidate
            >
              <input
                type="text"
                value={currentUsername}
                readOnly
                className="w-full px-4 py-2 text-xs font-bold border outline-none rounded-xl border-navy/10 bg-background text-navy/60"
              />
              <div className="relative">
                <input
                  type={showGroupAttrAuthPassword ? "text" : "password"}
                  value={groupAttrAuthPassword}
                  onChange={(event) =>
                    setGroupAttrAuthPassword(event.target.value)
                  }
                  placeholder="password"
                  className="w-full px-4 py-2 pr-10 text-xs font-bold border outline-none rounded-xl border-navy/10 bg-background text-navy focus:border-navy/30"
                  autoComplete="new-password"
                  required
                />
                <button
                  type="button"
                  onClick={() =>
                    setShowGroupAttrAuthPassword((previous) => !previous)
                  }
                  className="absolute -translate-y-1/2 right-3 top-1/2 text-navy/50"
                >
                  {showGroupAttrAuthPassword ? (
                    <EyeOff size={16} />
                  ) : (
                    <Eye size={16} />
                  )}
                </button>
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsGroupAttrAuthOpen(false)}
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
                  {submitting && (
                    <Loader2 size={14} className="mr-2 animate-spin" />
                  )}
                  OK
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isUserPwdManagerOpen && (
        <div className="fixed top-[-40px] left-0 right-0 bottom-0 z-[120] min-h-screen w-screen flex items-center justify-center bg-navy/30 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl p-6 bg-white border shadow-2xl rounded-3xl border-navy/10 md:p-8">
            <h3 className="mb-2 text-sm font-black tracking-widest uppercase text-navy">
              Change User Password
            </h3>
            <p className="mb-6 text-[11px] font-semibold text-navy/50">
              Masukkan old password lalu password baru untuk akun yang sedang
              dipilih.
            </p>
            <form
              onSubmit={async (event) => {
                event.preventDefault();
                setUserPwdModalMessage("");
                setUserPwdOldError("");
                if (!selectedAttributeUser) {
                  setUserPwdModalMessage("User tidak valid.");
                  return;
                }
                if (
                  !String(userPwdOldValue || "").trim() ||
                  !String(userPwdNewValue || "").trim()
                ) {
                  setUserPwdModalMessage(
                    "Old password dan new password wajib diisi.",
                  );
                  return;
                }
                if (
                  String(userPwdNewValue || "") !==
                  String(userPwdConfirmValue || "")
                ) {
                  setUserPwdModalMessage("Confirm password tidak sama.");
                  return;
                }

                if (userPwdNewValue.length < 8) {
                  setUserPwdModalMessage("Password minimal 8 karakter.");
                  return;
                }

                const updated = await handleModifyOwnPassword({
                  user: selectedAttributeUser,
                  oldPassword: userPwdOldValue,
                  newPassword: userPwdNewValue,
                });

                if (updated?.success) {
                  setUserPwdModalMessage("");
                  setUserPwdOldError("");
                  setIsUserPwdManagerOpen(false);
                } else if (updated?.kind === "old-password") {
                  setUserPwdOldError("invalid");
                } else if (updated?.message) {
                  setUserPwdModalMessage(updated.message);
                } else {
                  setUserPwdModalMessage("");
                }
              }}
              className="space-y-4"
              autoComplete="off"
              noValidate
            >
              <input
                type="text"
                value={selectedAttributeUser?.name || ""}
                readOnly
                className="w-full px-4 py-2 text-xs font-bold border outline-none rounded-xl border-navy/10 bg-background text-navy/60"
              />
              <div className="relative">
                <input
                  type={showUserPwdOldValue ? "text" : "password"}
                  value={userPwdOldValue}
                  onChange={(event) => setUserPwdOldValue(event.target.value)}
                  placeholder="old password"
                  className={`w-full px-4 py-2 pr-10 text-xs font-bold border outline-none rounded-xl bg-background text-navy focus:border-navy/30 ${userPwdOldError ? "border-danger/40 ring-2 ring-danger/10" : "border-navy/10"}`}
                  autoComplete="new-password"
                  required
                />
                <button
                  type="button"
                  onClick={() =>
                    setShowUserPwdOldValue((previous) => !previous)
                  }
                  className="absolute -translate-y-1/2 right-3 top-1/2 text-navy/50"
                >
                  {showUserPwdOldValue ? (
                    <EyeOff size={16} />
                  ) : (
                    <Eye size={16} />
                  )}
                </button>
              </div>
              <div
                className={`h-1 w-full rounded-full ${userPwdOldError ? "bg-danger/20" : "bg-navy/5"}`}
                aria-hidden="true"
              >
                <div
                  className={`h-full rounded-full transition-all ${userPwdOldError ? "w-full bg-danger" : "w-0 bg-transparent"}`}
                />
              </div>
              <div className="relative">
                <input
                  type={showUserPwdNewValue ? "text" : "password"}
                  value={userPwdNewValue}
                  onChange={(event) => setUserPwdNewValue(event.target.value)}
                  placeholder="new password"
                  className={`w-full px-4 py-2 pr-10 text-xs font-bold border outline-none rounded-xl bg-background text-navy focus:border-navy/30 ${userPwdStrengthLevel === 2 ? "border-success/40 ring-2 ring-success/10" : userPwdStrengthLevel === 1 ? "border-warning/40 ring-2 ring-warning/10" : "border-navy/10"}`}
                  autoComplete="new-password"
                  required
                />
                <button
                  type="button"
                  onClick={() =>
                    setShowUserPwdNewValue((previous) => !previous)
                  }
                  className="absolute -translate-y-1/2 right-3 top-1/2 text-navy/50"
                >
                  {showUserPwdNewValue ? (
                    <EyeOff size={16} />
                  ) : (
                    <Eye size={16} />
                  )}
                </button>
              </div>
              <div className="grid grid-cols-3 gap-1" aria-hidden="true">
                {Array.from({ length: 3 }, (_, index) => {
                  const active = index < userPwdStrengthLevel;
                  const colorClass =
                    userPwdStrengthLevel === 2
                      ? "bg-success"
                      : userPwdStrengthLevel === 1
                        ? "bg-warning"
                        : "bg-navy/5";

                  return (
                    <div
                      key={index}
                      className={`h-1 rounded-full transition-all ${active ? colorClass : "bg-navy/5"}`}
                    />
                  );
                })}
              </div>
              <div className="relative">
                <input
                  type={showUserPwdConfirmValue ? "text" : "password"}
                  value={userPwdConfirmValue}
                  onChange={(event) =>
                    setUserPwdConfirmValue(event.target.value)
                  }
                  placeholder="confirm password"
                  className="w-full px-4 py-2 pr-10 text-xs font-bold border outline-none rounded-xl border-navy/10 bg-background text-navy focus:border-navy/30"
                  autoComplete="new-password"
                  required
                />
                <button
                  type="button"
                  onClick={() =>
                    setShowUserPwdConfirmValue((previous) => !previous)
                  }
                  className="absolute -translate-y-1/2 right-3 top-1/2 text-navy/50"
                >
                  {showUserPwdConfirmValue ? (
                    <EyeOff size={16} />
                  ) : (
                    <Eye size={16} />
                  )}
                </button>
              </div>
              {String(userPwdNewValue || "") !==
                String(userPwdConfirmValue || "") && (
                <p className="text-[11px] font-bold text-danger">
                  Confirm password tidak sama.
                </p>
              )}
              {userPwdModalMessage && (
                <p className="text-[11px] font-bold text-danger">
                  {userPwdModalMessage}
                </p>
              )}
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setUserPwdModalMessage("");
                    setIsUserPwdManagerOpen(false);
                  }}
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
                  {submitting && (
                    <Loader2 size={14} className="mr-2 animate-spin" />
                  )}
                  OK
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isUserPwdAuthOpen && (
        <div className="fixed top-[-40px] left-0 right-0 bottom-0 z-[120] min-h-screen w-screen flex items-center justify-center bg-navy/30 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl p-6 bg-white border shadow-2xl rounded-3xl border-navy/10 md:p-8">
            <h3 className="mb-2 text-sm font-black tracking-widest uppercase text-navy">
              Authentication Password
            </h3>
            <p className="mb-6 text-[11px] font-semibold text-navy/50">
              {userPwdAuthMode === "applyDescription"
                ? "Masukkan password akun aktif untuk menyimpan perubahan description."
                : "Masukkan password akun aktif untuk melanjutkan perubahan password."}
            </p>
            <form
              onSubmit={async (event) => {
                event.preventDefault();
                if (userPwdAuthMode === "applyDescription") {
                  const verified = await verifyActiveUserPassword({
                    password: userPwdAuthPassword,
                  });
                  if (!verified) {
                    return;
                  }

                  const pending = pendingUserDescriptionApply;
                  if (!pending?.user) {
                    setUserPwdModalMessage("Target update tidak ditemukan.");
                    return;
                  }

                  const updated = await handleModifyUserDescription({
                    user: pending.user,
                    remark: pending.remark,
                  });
                  if (updated) {
                    setUserPwdModalMessage("");
                    setUserPwdOldError("");
                    setPendingUserDescriptionApply(null);
                    setUserPwdAuthMode("changePassword");
                    setUserPwdAuthPassword("");
                    setShowUserPwdAuthPassword(false);
                    setIsUserPwdAuthOpen(false);
                  }
                  return;
                }

                const verified = await verifyActiveUserPassword({
                  password: userPwdAuthPassword,
                });
                if (!verified) {
                  return;
                }
                setIsUserPwdAuthOpen(false);
                setUserPwdAuthPassword("");
                setShowUserPwdAuthPassword(false);
                setUserPwdManagerPassword("");
                setShowUserPwdManagerPassword(false);
                setUserPwdModalMessage("");
                setUserPwdAuthMode("changePassword");
                setIsUserPwdManagerOpen(true);
              }}
              className="space-y-4"
              autoComplete="off"
              noValidate
            >
              <input
                type="text"
                value={currentUsername}
                readOnly
                className="w-full px-4 py-2 text-xs font-bold border outline-none rounded-xl border-navy/10 bg-background text-navy/60"
              />
              <div className="relative">
                <input
                  type={showUserPwdAuthPassword ? "text" : "password"}
                  value={userPwdAuthPassword}
                  onChange={(event) =>
                    setUserPwdAuthPassword(event.target.value)
                  }
                  placeholder="password"
                  className="w-full px-4 py-2 pr-10 text-xs font-bold border outline-none rounded-xl border-navy/10 bg-background text-navy focus:border-navy/30"
                  autoComplete="new-password"
                  required
                />
                <button
                  type="button"
                  onClick={() =>
                    setShowUserPwdAuthPassword((previous) => !previous)
                  }
                  className="absolute -translate-y-1/2 right-3 top-1/2 text-navy/50"
                >
                  {showUserPwdAuthPassword ? (
                    <EyeOff size={16} />
                  ) : (
                    <Eye size={16} />
                  )}
                </button>
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsUserPwdAuthOpen(false);
                    setPendingUserDescriptionApply(null);
                    setUserPwdAuthMode("changePassword");
                    setUserPwdAuthPassword("");
                    setShowUserPwdAuthPassword(false);
                  }}
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
                  OK
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isDeleteAuthOpen && (
        <div className="fixed top-[-40px] left-0 right-0 bottom-0 z-[100] min-h-screen w-screen flex items-center justify-center bg-navy/30 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl p-6 bg-white border shadow-2xl rounded-3xl border-navy/10 md:p-8">
            <h3 className="mb-2 text-sm font-black tracking-widest uppercase text-navy">
              Authentication Password
            </h3>
            <p className="mb-6 text-[11px] font-semibold text-navy/50">
              Masukkan password dulu untuk menghapus{" "}
              {deleteTarget?.kind === "group" ? "group" : "user"} ini.
            </p>

            {deleteAuthMessage && (
              <div className="mb-4 rounded-2xl border border-danger/20 bg-danger/10 px-4 py-3 text-[11px] font-bold text-danger">
                {deleteAuthMessage}
              </div>
            )}

            <form
              ref={deletePasswordFormRef}
              onSubmit={confirmDeleteAuth}
              className="space-y-4"
              autoComplete="off"
              noValidate
            >
              <input
                type="text"
                value={currentUsername}
                readOnly
                className="w-full px-4 py-2 text-xs font-bold border outline-none rounded-xl border-navy/10 bg-background text-navy/60"
                placeholder="username"
                autoComplete="off"
              />
              <div className="relative">
                <input
                  key={isDeleteAuthOpen ? "open" : "closed"}
                  type={showDeletePassword ? "text" : "password"}
                  value={deleteAuthPassword}
                  onChange={(event) =>
                    setDeleteAuthPassword(event.target.value)
                  }
                  placeholder="password"
                  className="w-full px-4 py-2 pr-10 text-xs font-bold border outline-none rounded-xl border-navy/10 bg-background text-navy focus:border-navy/30"
                  required
                  autoFocus
                  autoComplete="new-password"
                  name="auth_temp_pass"
                  data-lpignore="true"
                  data-1p-ignore="true"
                  spellCheck="false"
                />
                <button
                  type="button"
                  onClick={() => setShowDeletePassword(!showDeletePassword)}
                  className="absolute transition-colors transform -translate-y-1/2 right-3 top-1/2 text-navy/50 hover:text-navy/70"
                  tabIndex={-1}
                  title={showDeletePassword ? "Hide password" : "Show password"}
                >
                  {showDeletePassword ? (
                    <EyeOff size={16} />
                  ) : (
                    <Eye size={16} />
                  )}
                </button>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => closeDeleteAuthModal()}
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
                  OK
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isAddGroupOpen && (
        <div className="fixed top-[-40px] inset-0 z-[100] flex items-center justify-center bg-navy/30 p-4 backdrop-blur-sm">
          <div className="w-full max-w-3xl p-6 bg-white border shadow-2xl rounded-3xl border-navy/10 md:p-8">
            <h3 className="mb-2 text-sm font-black tracking-widest uppercase text-navy">
              Add New Group
            </h3>
            <p className="mb-6 text-[11px] font-semibold text-navy/50">
              Menggunakan endpoint /cgi-bin/api/userManager/addGroup.
            </p>

            <form onSubmit={handleAddGroup} className="space-y-4">
              <div className="flex items-center gap-4 border-b border-navy/10">
                <button
                  type="button"
                  onClick={() => setGroupEditorTab("attribute")}
                  className={`border-b-2 px-1 py-2 text-sm font-semibold ${groupEditorTab === "attribute" ? "border-navy text-navy" : "border-transparent text-navy/40"}`}
                >
                  Attribute
                </button>
                <button
                  type="button"
                  onClick={() => setGroupEditorTab("permission")}
                  className={`border-b-2 px-1 py-2 text-sm font-semibold ${groupEditorTab === "permission" ? "border-navy text-navy" : "border-transparent text-navy/40"}`}
                >
                  Permission
                </button>
              </div>

              {groupEditorTab === "attribute" ? (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-[220px_1fr] md:items-start">
                  <label className="text-sm font-medium text-navy/80">
                    Name
                  </label>
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={groupFormData.name}
                      onChange={(event) =>
                        setGroupFormData((prev) => ({
                          ...prev,
                          name: event.target.value,
                        }))
                      }
                      placeholder="group name"
                      className="w-full px-4 py-2 text-xs font-bold border outline-none rounded-xl border-navy/10 bg-background text-navy focus:border-navy/30"
                      required
                    />
                    <p className="px-3 py-2 text-xs border rounded border-amber-200 bg-amber-50 text-amber-800">
                      Username can include numbers, letters, underlines, dots
                      and @.
                    </p>
                  </div>

                  <label className="text-sm font-medium text-navy/80">
                    Parent Node
                  </label>
                  <input
                    type="text"
                    value="EvoSecure"
                    readOnly
                    className="w-full px-4 py-2 text-xs font-bold border outline-none rounded-xl border-navy/10 bg-background text-navy/60"
                  />

                  <label className="text-sm font-medium text-navy/80">
                    Description
                  </label>
                  <textarea
                    value={groupFormData.memo}
                    onChange={(event) =>
                      setGroupFormData((prev) => ({
                        ...prev,
                        memo: event.target.value,
                      }))
                    }
                    placeholder="description / memo"
                    rows={3}
                    className="w-full px-4 py-2 text-xs font-bold border outline-none resize-none rounded-xl border-navy/10 bg-background text-navy focus:border-navy/30"
                  />
                </div>
              ) : (
                <div className="pb-1 overflow-x-auto">
                  <div className="grid min-w-[940px] grid-cols-[1fr_1fr_1fr_1.75fr] gap-3">
                    {Object.entries(GROUP_PERMISSION_SECTIONS).map(
                      ([sectionKey, section]) => {
                        const sectionTokens = getSectionTokens(sectionKey);
                        const selectAllChecked =
                          sectionTokens.length > 0 &&
                          sectionTokens.every((token) =>
                            selectedGroupAuthorities.includes(token),
                          );

                        return (
                          <div
                            key={sectionKey}
                            className="overflow-hidden bg-white border rounded-xl border-navy/10"
                          >
                            <div className="flex items-center justify-between px-4 py-3">
                              <h3 className="text-2xl font-semibold text-navy/90">
                                {section.label}
                              </h3>
                            </div>
                            <div className="px-4 py-3 space-y-3 border-t border-navy/10 min-h-[300px]">
                              <label className="inline-flex items-center gap-2 text-xs font-medium whitespace-nowrap text-navy/60">
                                <input
                                  type="checkbox"
                                  checked={selectAllChecked}
                                  onChange={(event) =>
                                    setGroupFormData((previous) => ({
                                      ...previous,
                                      authority: setAuthorityValues(
                                        previous.authority,
                                        sectionTokens,
                                        event.target.checked,
                                      ),
                                    }))
                                  }
                                  className="w-4 h-4 text-gray-400 bg-gray-100 border-gray-300 rounded-sm accent-gray-300"
                                />
                                Select All
                              </label>
                              {section.items.map((item) => {
                                const checked =
                                  selectedGroupAuthorities.includes(item.token);
                                return (
                                  <label
                                    key={`${sectionKey}-${item.label}`}
                                    className="flex items-center gap-2 text-sm leading-tight text-navy/70"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      onChange={(event) =>
                                        setGroupFormData((previous) => ({
                                          ...previous,
                                          authority: setAuthorityValue(
                                            previous.authority,
                                            item.token,
                                            event.target.checked,
                                          ),
                                        }))
                                      }
                                      className="w-4 h-4 text-gray-400 bg-gray-100 border-gray-300 rounded-sm accent-gray-300"
                                    />
                                    <span>{item.label}</span>
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        );
                      },
                    )}

                    <div className="overflow-hidden bg-white border rounded-xl border-navy/10">
                      <div className="flex items-center justify-between px-4 py-3">
                        <div className="flex items-center gap-4">
                          <h3 className="text-2xl font-semibold text-navy/90">
                            Channel
                          </h3>
                          <label className="inline-flex items-center gap-2 text-sm font-medium whitespace-nowrap text-navy/70">
                            <span>Show All</span>
                            <button
                              type="button"
                              role="switch"
                              aria-checked={showAllChannels}
                              onClick={() =>
                                setShowAllChannels((prev) => !prev)
                              }
                              className={`relative h-6 w-10 rounded-full transition-colors ${showAllChannels ? "bg-sky-500" : "bg-navy/25"}`}
                            >
                              <span
                                className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${showAllChannels ? "-translate-x-0.5" : "-translate-x-4"}`}
                              />
                            </button>
                          </label>
                        </div>
                        <label className="inline-flex items-center gap-2 text-xs font-medium whitespace-nowrap text-navy/60">
                          <input
                            type="checkbox"
                            checked={
                              allPermissionChannels.length > 0 &&
                              allPermissionChannels.every((channel) => {
                                const liveToken = getChannelToken(
                                  channel.id,
                                  "live",
                                );
                                const playbackToken = getChannelToken(
                                  channel.id,
                                  "playback",
                                );
                                return (
                                  isChannelChecked(liveToken) &&
                                  isChannelChecked(playbackToken)
                                );
                              })
                            }
                            onChange={(event) => {
                              const nextAuthorities =
                                allPermissionChannels.flatMap((channel) => [
                                  getChannelToken(channel.id, "live"),
                                  getChannelToken(channel.id, "playback"),
                                ]);

                              setGroupFormData((previous) => ({
                                ...previous,
                                authority: setAuthorityValues(
                                  previous.authority,
                                  nextAuthorities,
                                  event.target.checked,
                                ),
                              }));
                            }}
                            className="w-4 h-4 text-gray-400 bg-gray-100 border-gray-300 rounded-sm accent-gray-300"
                          />
                          Select All
                        </label>
                      </div>
                      <div className="px-4 py-3 space-y-3 border-t border-navy/10 min-h-[300px]">
                        <div className="grid grid-cols-[1.7fr_1fr_1fr] text-sm text-navy/60">
                          <div>Channel</div>
                          <div className="text-center">Live</div>
                          <div className="text-center">Playback</div>
                        </div>

                        {pagedPermissionChannels.map((channel) => {
                          const liveToken = getChannelToken(channel.id, "live");
                          const playbackToken = getChannelToken(
                            channel.id,
                            "playback",
                          );
                          const liveChecked =
                            selectedGroupAuthorities.includes(liveToken);
                          const playbackChecked =
                            selectedGroupAuthorities.includes(playbackToken);

                          return (
                            <div
                              key={`group-channel-${channel.id}`}
                              className="grid grid-cols-[1.7fr_1fr_1fr] items-start gap-2 text-sm text-navy/60"
                            >
                              <div className="pr-2 leading-tight break-words">
                                {channel.id}-{channel.name}
                              </div>
                              <label className="inline-flex items-center justify-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={liveChecked}
                                  onChange={(event) =>
                                    setGroupFormData((previous) => ({
                                      ...previous,
                                      authority: setAuthorityValue(
                                        previous.authority,
                                        liveToken,
                                        event.target.checked,
                                      ),
                                    }))
                                  }
                                  className="w-4 h-4 text-gray-400 bg-gray-100 border-gray-300 rounded-sm accent-gray-300"
                                />
                                <span>Enable</span>
                              </label>
                              <label className="inline-flex items-center justify-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={playbackChecked}
                                  onChange={(event) =>
                                    setGroupFormData((previous) => ({
                                      ...previous,
                                      authority: setAuthorityValue(
                                        previous.authority,
                                        playbackToken,
                                        event.target.checked,
                                      ),
                                    }))
                                  }
                                  className="w-4 h-4 text-gray-400 bg-gray-100 border-gray-300 rounded-sm accent-gray-300"
                                />
                                <span>Enable</span>
                              </label>
                            </div>
                          );
                        })}

                        <div className="flex items-center justify-between gap-3 pt-1 text-sm text-navy/80">
                          <span>
                            Total {allPermissionChannels.length} items
                          </span>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                setChannelPage((prev) => Math.max(1, prev - 1))
                              }
                              disabled={channelPage <= 1}
                              className="px-2 py-1 text-xs border rounded border-navy/20 text-navy/70 disabled:opacity-40"
                            >
                              &lt;
                            </button>
                            <div className="flex items-center gap-1">
                              {channelPageNumbers.map((pageNumber) => (
                                <button
                                  key={`channel-page-${pageNumber}`}
                                  type="button"
                                  onClick={() => setChannelPage(pageNumber)}
                                  className={`min-w-7 px-2 py-1 text-xs border rounded ${pageNumber === channelPage ? "border-sky-500 bg-sky-50 text-sky-700" : "border-navy/20 text-navy/70"}`}
                                >
                                  {pageNumber}
                                </button>
                              ))}
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                setChannelPage((prev) =>
                                  Math.min(channelTotalPages, prev + 1),
                                )
                              }
                              disabled={channelPage >= channelTotalPages}
                              className="px-2 py-1 text-xs border rounded border-navy/20 text-navy/70 disabled:opacity-40"
                            >
                              &gt;
                            </button>
                            <span className="ml-1 text-xs text-navy/60">
                              {CHANNELS_PER_PAGE} / page
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeAddGroupModal}
                  className="px-4 py-2 text-xs font-black tracking-widest uppercase border rounded-xl border-navy/10 text-navy/70"
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center px-4 py-2 text-xs font-black tracking-widest text-white uppercase rounded-xl bg-navy disabled:opacity-60"
                  disabled={submitting || !canSubmitAddGroup}
                  title={
                    !canSubmitAddGroup
                      ? "Pilih minimal satu permission"
                      : "Submit Add Group"
                  }
                >
                  {submitting && (
                    <Loader2 size={14} className="mr-2 animate-spin" />
                  )}
                  Submit Add Group
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {(isAddOpen || isEditOpen) && (
        <div className="fixed top-[-40px] inset-0 z-[100] flex items-center justify-center bg-navy/30 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl p-6 bg-white border shadow-2xl rounded-3xl border-navy/10 md:p-8">
            <h3 className="mb-2 text-sm font-black tracking-widest uppercase text-navy">
              {isAddOpen ? "Add New User" : "Modify User"}
            </h3>
            <p className="mb-6 text-[11px] font-semibold text-navy/50">
              {isAddOpen
                ? "Isi data akun baru sesuai format userManager endpoint."
                : "Perbarui profile user. Password boleh dikosongkan jika tidak ingin diubah."}
            </p>

            <form
              onSubmit={(event) => {
                event.preventDefault();
                if (isAddOpen && formData.password.length < 8) {
                  alert("Password minimal 8 karakter.");
                  return;
                }
                if (isAddOpen && formData.password !== addUserConfirmPassword) {
                  alert("Confirm password tidak sama.");
                  return;
                }
                if (isAddOpen) {
                  handleAddUser(event);
                } else {
                  if (!String(editAuthPassword || "").trim()) {
                    alert("Authentication password wajib diisi untuk edit user.");
                    return;
                  }

                  verifyActiveUserPassword({ password: editAuthPassword }).then((verified) => {
                    if (!verified) {
                      return;
                    }
                    handleModifyUser(event);
                  });
                }
              }}
              className="space-y-4"
            >
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <input
                  type="text"
                  value={formData.name}
                  onChange={(event) =>
                    setFormData((prev) => ({
                      ...prev,
                      name: event.target.value,
                    }))
                  }
                  placeholder="name"
                  className="px-4 py-2 text-xs font-bold border outline-none rounded-xl border-navy/10 bg-background text-navy focus:border-navy/30"
                  required
                  readOnly={isEditOpen}
                />

                {isAddOpen ? (
                  <div className="flex flex-col gap-2">
                    <input
                      type="password"
                      value={formData.password}
                      onChange={(event) =>
                        setFormData((prev) => ({
                          ...prev,
                          password: event.target.value,
                        }))
                      }
                      placeholder="password"
                      className={`px-4 py-2 text-xs font-bold border outline-none rounded-xl bg-background text-navy focus:border-navy/30 ${formDataPwdStrengthLevel === 2 ? "border-success/40 ring-2 ring-success/10" : formDataPwdStrengthLevel === 1 ? "border-warning/40 ring-2 ring-warning/10" : "border-navy/10"}`}
                      required
                    />
                    <div className="grid grid-cols-3 gap-1" aria-hidden="true">
                      {Array.from({ length: 3 }, (_, index) => {
                        const active = index < formDataPwdStrengthLevel;
                        const colorClass =
                          formDataPwdStrengthLevel === 2
                            ? "bg-success"
                            : formDataPwdStrengthLevel === 1
                              ? "bg-warning"
                              : "bg-navy/5";

                        return (
                          <div
                            key={index}
                            className={`h-1 rounded-full transition-all ${active ? colorClass : "bg-navy/5"}`}
                          />
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <input
                    type="password"
                    value={formData.oldPassword || ""}
                    onChange={(event) =>
                      setFormData((prev) => ({
                        ...prev,
                        oldPassword: event.target.value,
                      }))
                    }
                    placeholder="old password (for modifyPassword)"
                    className="px-4 py-2 text-xs font-bold border outline-none rounded-xl border-navy/10 bg-background text-navy focus:border-navy/30"
                  />
                )}

                {isEditOpen && (
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(event) =>
                      setFormData((prev) => ({
                        ...prev,
                        password: event.target.value,
                      }))
                    }
                    placeholder="new password (for modifyPassword)"
                    className="px-4 py-2 text-xs font-bold border outline-none rounded-xl border-navy/10 bg-background text-navy focus:border-navy/30"
                  />
                )}

                <input
                  type="text"
                  value={formData.group}
                  readOnly={isAddOpen}
                  onChange={(event) =>
                    setFormData((prev) => ({
                      ...prev,
                      group: event.target.value,
                    }))
                  }
                  placeholder="Parent Node"
                  className="px-4 py-2 text-xs font-bold border outline-none rounded-xl border-navy/10 bg-background text-navy focus:border-navy/30"
                />
                {isEditOpen && (
                  <input
                    type="password"
                    value={editAuthPassword}
                    onChange={(event) => setEditAuthPassword(event.target.value)}
                    placeholder="authentication password"
                    className="px-4 py-2 text-xs font-bold border outline-none rounded-xl border-navy/10 bg-background text-navy focus:border-navy/30"
                    autoComplete="new-password"
                  />
                )}
                <div className="flex flex-col gap-2">
                  <input
                    type="password"
                    value={addUserConfirmPassword}
                    onChange={(event) => {
                      if (typeof setAddUserConfirmPassword === 'function') {
                        setAddUserConfirmPassword(event.target.value);
                      } else {
                        // eslint-disable-next-line no-console
                        console.warn('setAddUserConfirmPassword is not a function');
                      }
                    }}
                    placeholder="confirm password"
                    className="px-4 py-2 text-xs font-bold border outline-none rounded-xl border-navy/10 bg-background text-navy focus:border-navy/30"
                    required={isAddOpen}
                  />
                  <div className="grid grid-cols-3 gap-1" aria-hidden="true">
                    {Array.from({ length: 3 }, (_, index) => {
                      const active = index < formDataPwdStrengthLevel;
                      const colorClass =
                        formDataPwdStrengthLevel === 2
                          ? "bg-success"
                          : formDataPwdStrengthLevel === 1
                            ? "bg-warning"
                            : "bg-navy/5";

                      return (
                        <div
                          key={index}
                          className={`h-1 rounded-full transition-all ${active ? colorClass : "bg-navy/5"}`}
                        />
                      );
                    })}
                  </div>
                </div>
              </div>

              <textarea
                value={formData.remark}
                onChange={(event) =>
                  setFormData((prev) => ({
                    ...prev,
                    remark: event.target.value,
                  }))
                }
                placeholder="remark"
                rows={3}
                className="w-full px-4 py-2 text-xs font-bold border outline-none resize-none rounded-xl border-navy/10 bg-background text-navy focus:border-navy/30"
              />

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
                  {submitting && (
                    <Loader2 size={14} className="mr-2 animate-spin" />
                  )}
                  {isAddOpen ? "Submit Add" : "Submit Modify"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* notification add/edit user */}
      {addEditNotification && (
        <div className="fixed z-50 max-w-sm duration-300 bottom-6 right-6 animate-in fade-in slide-in-from-bottom-4">
          <div className="p-4 border border-blue-200 shadow-lg rounded-2xl bg-blue-50">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 mt-1">
                <svg
                  className="w-5 h-5 text-blue-600"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-bold text-blue-900">
                  {addEditNotification.title}
                </h3>
                <p className="mt-1 text-xs font-semibold text-blue-700">
                  {addEditNotification.message}
                </p>
              </div>
              <button
                onClick={() => setAddEditNotification(null)}
                className="flex-shrink-0 text-blue-400 transition-colors hover:text-blue-600"
              >
                <svg
                  className="w-5 h-5"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* notification delete group */}
      {deleteNotification && (
        <div className="fixed z-50 max-w-sm duration-300 bottom-6 right-6 animate-in fade-in slide-in-from-bottom-4">
          <div className="p-4 border shadow-lg rounded-2xl border-emerald-200 bg-emerald-50">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 mt-1">
                <svg
                  className="w-5 h-5 text-emerald-600"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-bold text-emerald-900">
                  {deleteNotification.title}
                </h3>
                <p className="mt-1 text-xs font-semibold text-emerald-700">
                  {deleteNotification.message}
                </p>
              </div>
              <button
                onClick={() => setDeleteNotification(null)}
                className="flex-shrink-0 transition-colors text-emerald-400 hover:text-emerald-600"
              >
                <svg
                  className="w-5 h-5"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;
