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

function getChannelToken(channelId, action) {
  const prefix = action === "live" ? "Monitor" : "Replay";
  return `${prefix}_${String(channelId).padStart(2, "0")}`;
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
  const preserved = values.filter(
    (entry) => !tokens.includes(entry),
  );
  const tokenSet = new Set(values.filter((entry) => tokens.includes(entry)));

  tokens.forEach((token) => {
    if (checked) {
      tokenSet.add(token);
    } else {
      tokenSet.delete(token);
    }
  });

  return [
    ...preserved,
    ...tokens.filter((entry) => tokenSet.has(entry)),
  ].join(",");
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
    formData,
    setFormData,
    groupFormData,
    setGroupFormData,
    groupAuthPassword,
    setGroupAuthPassword,
    groupEditorTab,
    setGroupEditorTab,
    groupPermissionChannels,
    submitting,
    currentUsername,
    filteredUsers,
    loadAllUsers,
    openAddModal,
    openAddGroupAuthModal,
    openEditModal,
    closeAddModal,
    closeEditModal,
    closeGroupAuthModal,
    closeAddGroupModal,
    confirmGroupAuth,
    isDeleteAuthOpen,
    deleteAuthPassword,
    setDeleteAuthPassword,
    closeDeleteAuthModal,
    openDeleteAuthModal,
    confirmDeleteAuth,
    handleAddUser,
    handleAddGroup,
    handleModifyUser,
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
    selectedGroupUsers,
    selectedGroupInfo,
    selectedAttributeInfo,
    selectedAttributeUser,
    selectedUserForAttribute,
    setSelectedUserForAttribute,
    selectedUserForPermission,
    setSelectedUserForPermission,
    isUserManagementSupported,
    deleteNotification,
    setDeleteNotification,
  } = useUserManagement();

  const isAttributeTab = activeTab === "attribute";
  const isUserSelected = selectedAttributeInfo.isUserNode;
  const canShowPermissionTab = isUserSelected && Boolean(selectedUserForPermission);
  const selectedGroupAuthorities = parseAuthorityValues(groupFormData.authority);
  const selectedGroupObject = userGroups.find((group) => group.groupName === selectedGroup) || null;
  const deleteTarget = selectedAttributeInfo.isUserNode && selectedAttributeUser
    ? {
        kind: 'user',
        label: selectedAttributeUser.name,
        canDelete: true,
        title: `Delete User: ${selectedAttributeUser.name}`,
        user: selectedAttributeUser,
      }
    : selectedGroupObject
      ? {
          kind: 'group',
          label: selectedGroupObject.groupName,
          canDelete: canDeleteGroup(selectedGroupObject),
          title: canDeleteGroup(selectedGroupObject)
            ? `Delete Group: ${selectedGroupObject.groupName}`
            : 'Delete Group (group must be empty)',
          group: selectedGroupObject,
        }
      : null;

  const getSectionTokens = (sectionKey) => GROUP_PERMISSION_SECTIONS[sectionKey].items.map((item) => item.token);
  const areSectionTokensChecked = (sectionKey) => getSectionTokens(sectionKey).every((token) => selectedGroupAuthorities.includes(token));
  const isChannelChecked = (token) => selectedGroupAuthorities.includes(token);

  const [showDeletePassword, setShowDeletePassword] = React.useState(false);
  const deletePasswordFormRef = React.useRef(null);

  React.useEffect(() => {
    if (!isDeleteAuthOpen) {
      setShowDeletePassword(false);
      return;
    }

    // Force clear password field and reset form
    if (deletePasswordFormRef.current) {
      deletePasswordFormRef.current.reset();
    }
    
    // Explicitly clear the password input
    setDeleteAuthPassword('');
    
    // Use setTimeout to ensure browser autocomplete doesn't override after render
    const timeoutId = setTimeout(() => {
      if (deletePasswordFormRef.current) {
        const passwordInput = deletePasswordFormRef.current.querySelector('input[type="password"], input[type="text"][placeholder="password"]');
        if (passwordInput) {
          passwordInput.value = '';
          setDeleteAuthPassword('');
        }
      }
    }, 0);

    return () => clearTimeout(timeoutId);
  }, [isDeleteAuthOpen]);

  React.useEffect(() => {
    if (!deleteNotification) {
      return;
    }

    const timeoutId = setTimeout(() => {
      setDeleteNotification(null);
    }, 3000);

    return () => clearTimeout(timeoutId);
  }, [deleteNotification, setDeleteNotification]);

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
              disabled={!isUserManagementSupported}
              className="inline-flex items-center justify-center w-10 h-10 transition-colors border group rounded-xl border-navy/10 text-navy/70 hover:bg-navy/5 hover:text-navy disabled:cursor-not-allowed disabled:opacity-40"
              title="Add Group"
              aria-label="Add Group"
            >
              <Shield size={16} />
            </button>
            <button
              type="button"
              onClick={openAddModal}
              disabled={!isUserManagementSupported}
              className="inline-flex items-center justify-center w-10 h-10 text-white transition-colors border group rounded-xl border-navy/10 bg-navy hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              title="Add User"
              aria-label="Add User"
            >
              <UserPlus size={16} />
            </button>
            <button
              type="button"
              onClick={() => deleteTarget?.canDelete && openDeleteAuthModal(deleteTarget)}
              disabled={!deleteTarget?.canDelete}
              className="inline-flex items-center justify-center w-10 h-10 transition-colors border group rounded-xl border-danger/20 text-danger hover:bg-danger/5 disabled:cursor-not-allowed disabled:opacity-40"
              title={deleteTarget?.title || 'Delete'}
              aria-label={deleteTarget?.title || 'Delete'}
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
          ⚠️ Perangkat tidak mendukung penambahan atau perubahan user. Fitur Add User dan Edit User telah dinonaktifkan.
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
                // Toggle tree expansion so header can both open and close
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
                {userGroups.map((group) => {
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
                        value={selectedAttributeInfo.name}
                        readOnly
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
                        value={selectedAttributeInfo.description}
                        readOnly
                        rows={3}
                        className="w-full px-4 py-2 text-sm font-medium border rounded-md outline-none border-navy/10 bg-background text-navy"
                      />
                    </div>
                    {selectedAttributeInfo.isUserNode && (
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            selectedAttributeUser &&
                            openEditModal(selectedAttributeUser)
                          }
                          disabled={!isUserManagementSupported}
                          className="inline-flex items-center gap-1 rounded-md border border-navy/10 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-navy/70 hover:bg-navy/5 disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Ganti password"
                        >
                          <Edit3 size={12} />
                          Edit Data
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {!selectedAttributeInfo.isUserNode && selectedGroup === "all" && (
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

                {!selectedAttributeInfo.isUserNode && selectedGroup !== "all" && (
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

      {isGroupAuthOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-navy/30 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl p-6 bg-white border shadow-2xl rounded-3xl border-navy/10 md:p-8">
            <h3 className="mb-2 text-sm font-black tracking-widest uppercase text-navy">
              Authentication Password
            </h3>
            <p className="mb-6 text-[11px] font-semibold text-navy/50">
              Masukkan password akun aktif sebelum menambahkan group baru.
            </p>

            <form onSubmit={confirmGroupAuth} className="space-y-4">
              <input
                type="text"
                value={currentUsername}
                readOnly
                className="w-full px-4 py-2 text-xs font-bold border outline-none rounded-xl border-navy/10 bg-background text-navy/60"
                placeholder="username"
              />
              <input
                type="password"
                value={groupAuthPassword}
                onChange={(event) => setGroupAuthPassword(event.target.value)}
                placeholder="password"
                className="w-full px-4 py-2 text-xs font-bold border outline-none rounded-xl border-navy/10 bg-background text-navy focus:border-navy/30"
                required
              />

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

      {isDeleteAuthOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-navy/30 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl p-6 bg-white border shadow-2xl rounded-3xl border-navy/10 md:p-8">
            <h3 className="mb-2 text-sm font-black tracking-widest uppercase text-navy">
              Authentication Password
            </h3>
            <p className="mb-6 text-[11px] font-semibold text-navy/50">
              Masukkan password dulu untuk menghapus {deleteTarget?.kind === 'group' ? 'group' : 'user'} ini.
            </p>

            <form ref={deletePasswordFormRef} onSubmit={confirmDeleteAuth} className="space-y-4" autoComplete="off" noValidate>
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
                  key={isDeleteAuthOpen ? 'open' : 'closed'}
                  type={showDeletePassword ? "text" : "password"}
                  value={deleteAuthPassword}
                  onChange={(event) => setDeleteAuthPassword(event.target.value)}
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
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-navy/30 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl p-6 bg-white border shadow-2xl rounded-3xl border-navy/10 md:p-8">
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
                  <label className="text-sm font-medium text-navy/80">Name</label>
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
                      Username can include numbers, letters, underlines, dots and @.
                    </p>
                  </div>

                  <label className="text-sm font-medium text-navy/80">Parent Node</label>
                  <input
                    type="text"
                    value="EvoSecure"
                    readOnly
                    className="w-full px-4 py-2 text-xs font-bold border outline-none rounded-xl border-navy/10 bg-background text-navy/60"
                  />

                  <label className="text-sm font-medium text-navy/80">Description</label>
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
                <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1fr_1fr_1fr_1.75fr]">
                  {Object.entries(GROUP_PERMISSION_SECTIONS).map(([sectionKey, section]) => {
                    const sectionTokens = getSectionTokens(sectionKey);
                    const selectAllChecked = sectionTokens.length > 0 && sectionTokens.every((token) => selectedGroupAuthorities.includes(token));

                    return (
                      <div key={sectionKey} className="bg-white border border-navy/10">
                        <div className="flex items-center justify-between px-4 py-3">
                          <h3 className="text-lg font-semibold text-navy/90">{section.label}</h3>
                          <label className="inline-flex items-center gap-2 text-xs font-medium text-navy/60">
                            <input
                              type="checkbox"
                              checked={selectAllChecked}
                              onChange={(event) =>
                                setGroupFormData((previous) => ({
                                  ...previous,
                                  authority: setAuthorityValues(previous.authority, sectionTokens, event.target.checked),
                                }))
                              }
                              className="w-4 h-4 text-gray-400 bg-gray-100 border-gray-300 rounded-sm accent-gray-300"
                            />
                            Select All
                          </label>
                        </div>
                        <div className="px-4 py-3 space-y-3 border-t border-navy/10">
                          {section.items.map((item) => {
                            const checked = selectedGroupAuthorities.includes(item.token);
                            return (
                              <label key={`${sectionKey}-${item.label}`} className="flex items-center gap-2 text-sm text-navy/70">
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
                  })}

                  <div className="bg-white border border-navy/10">
                    <div className="flex items-center justify-between px-4 py-3">
                      <h3 className="text-lg font-semibold text-navy/90">Channel</h3>
                      <label className="inline-flex items-center gap-2 text-xs font-medium text-navy/60">
                        <input
                          type="checkbox"
                          checked={
                            groupPermissionChannels.length > 0
                            && groupPermissionChannels.every((channel) => {
                              const liveToken = getChannelToken(channel.id, "live");
                              const playbackToken = getChannelToken(channel.id, "playback");
                              return isChannelChecked(liveToken) && isChannelChecked(playbackToken);
                            })
                          }
                          onChange={(event) => {
                            const nextAuthorities = groupPermissionChannels.flatMap((channel) => [
                              getChannelToken(channel.id, "live"),
                              getChannelToken(channel.id, "playback"),
                            ]);

                            setGroupFormData((previous) => ({
                              ...previous,
                              authority: setAuthorityValues(previous.authority, nextAuthorities, event.target.checked),
                            }));
                          }}
                          className="w-4 h-4 text-gray-400 bg-gray-100 border-gray-300 rounded-sm accent-gray-300"
                        />
                        Select All
                      </label>
                    </div>
                    <div className="px-4 py-3 space-y-3 border-t border-navy/10">
                      <div className="grid grid-cols-[1.7fr_1fr_1fr] text-sm text-navy/60">
                        <div>Channel</div>
                        <div>Live</div>
                        <div>Playback</div>
                      </div>

                      {groupPermissionChannels.map((channel) => {
                        const liveToken = getChannelToken(channel.id, "live");
                        const playbackToken = getChannelToken(channel.id, "playback");
                        const liveChecked = selectedGroupAuthorities.includes(liveToken);
                        const playbackChecked = selectedGroupAuthorities.includes(playbackToken);

                        return (
                          <div key={`group-channel-${channel.id}`} className="grid grid-cols-[1.7fr_1fr_1fr] items-start text-sm text-navy/60">
                            <div>{channel.id}-{channel.name}</div>
                            <label className="inline-flex items-center gap-2">
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
                            <label className="inline-flex items-center gap-2">
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

                      <div className="pt-1 text-sm text-navy/80">Total {groupPermissionChannels.length} items</div>
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
                  disabled={submitting}
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
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-navy/30 p-4 backdrop-blur-sm">
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
              onSubmit={isAddOpen ? handleAddUser : handleModifyUser}
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
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(event) =>
                      setFormData((prev) => ({
                        ...prev,
                        password: event.target.value,
                      }))
                    }
                    placeholder="password (required)"
                    className="px-4 py-2 text-xs font-bold border outline-none rounded-xl border-navy/10 bg-background text-navy focus:border-navy/30"
                    required
                  />
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
                  onChange={(event) =>
                    setFormData((prev) => ({
                      ...prev,
                      group: event.target.value,
                    }))
                  }
                  placeholder="group (contoh: admin)"
                  className="px-4 py-2 text-xs font-bold border outline-none rounded-xl border-navy/10 bg-background text-navy focus:border-navy/30"
                />
                <div className="px-3 py-3 border rounded-xl border-navy/10 bg-background md:col-span-2">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-[11px] font-black uppercase tracking-widest text-navy/60">
                      Authority List
                    </p>
                    <p className="text-[10px] font-semibold text-navy/40">
                      Checkbox only, value tetap disimpan sebagai AuthorityList
                    </p>
                  </div>
                  <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
                    {AUTHORITY_OPTIONS.map((option) => {
                      const selectedAuthorities = parseAuthorityValues(
                        formData.authority,
                      );
                      const isChecked = selectedAuthorities.includes(
                        option.value,
                      );

                      return (
                        <label
                          key={option.value}
                          className="flex items-center gap-2 px-3 py-2 text-xs font-semibold bg-white border rounded-lg border-navy/10 text-navy/65"
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(event) =>
                              setFormData((previous) => ({
                                ...previous,
                                authority: setAuthorityValue(
                                  previous.authority,
                                  option.value,
                                  event.target.checked,
                                ),
                              }))
                            }
                            className="w-4 h-4 text-gray-400 bg-gray-100 border-gray-300 rounded-sm accent-gray-300"
                          />
                          <span>{option.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <label className="inline-flex items-center gap-2 rounded-xl border border-navy/10 bg-background px-3 py-2 text-[11px] font-bold text-navy/70">
                  <input
                    type="checkbox"
                    checked={Boolean(formData.sharable)}
                    onChange={(event) =>
                      setFormData((prev) => ({
                        ...prev,
                        sharable: event.target.checked,
                      }))
                    }
                    className="w-4 h-4"
                  />
                  Sharable
                </label>
                <label className="inline-flex items-center gap-2 rounded-xl border border-navy/10 bg-background px-3 py-2 text-[11px] font-bold text-navy/70">
                  <input
                    type="checkbox"
                    checked={Boolean(formData.reserved)}
                    onChange={(event) =>
                      setFormData((prev) => ({
                        ...prev,
                        reserved: event.target.checked,
                      }))
                    }
                    className="w-4 h-4"
                  />
                  Reserved
                </label>
                <label className="inline-flex items-center gap-2 rounded-xl border border-navy/10 bg-background px-3 py-2 text-[11px] font-bold text-navy/70">
                  <input
                    type="checkbox"
                    checked={Boolean(formData.needModPwd)}
                    onChange={(event) =>
                      setFormData((prev) => ({
                        ...prev,
                        needModPwd: event.target.checked,
                      }))
                    }
                    className="w-4 h-4"
                  />
                  NeedModPwd
                </label>
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

              <textarea
                value={formData.extraQuery}
                onChange={(event) =>
                  setFormData((prev) => ({
                    ...prev,
                    extraQuery: event.target.value,
                  }))
                }
                placeholder="Parameter query tambahan (opsional), contoh: pwd=12345&authority=admin"
                rows={2}
                className="w-full resize-none rounded-xl border border-navy/10 bg-background px-4 py-2 font-mono text-[11px] text-navy outline-none focus:border-navy/30"
              />

              <p className="text-[10px] font-bold text-navy/50">
                Jika perangkat membutuhkan format parameter khusus untuk
                add/modify user, isi pada kolom query tambahan.
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

      {/* notification delete group */}
      {deleteNotification && (
        <div className="fixed z-50 max-w-sm duration-300 bottom-6 right-6 animate-in fade-in slide-in-from-bottom-4">
          <div className="p-4 border shadow-lg rounded-2xl border-emerald-200 bg-emerald-50">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 mt-1">
                <svg className="w-5 h-5 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
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
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
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
