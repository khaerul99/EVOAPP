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
    selectedAttributeInfo,
    selectedAttributeUser,
    selectedUserForAttribute,
    setSelectedUserForAttribute,
    selectedUserForPermission,
    setSelectedUserForPermission,
    onvifAvailable,
    onvifUsers,
    isUserManagementSupported,
  } = useUserManagement();

  const isAttributeTab = activeTab === "attribute";
  const isUserSelected = selectedAttributeInfo.isUserNode;
  const canShowPermissionTab = isUserSelected && Boolean(selectedUserForPermission);

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
            className="p-3 transition-colors bg-white border rounded-xl border-navy/5 text-navy/50 hover:text-navy"
            title="Refresh user list"
          >
            <RefreshCw size={18} />
          </button>
          <button
            type="button"
            onClick={openAddModal}
            disabled={!isUserManagementSupported}
            className="inline-flex items-center gap-2 px-4 py-3 text-xs font-black tracking-widest text-white uppercase shadow-lg rounded-xl bg-navy shadow-navy/10 hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <UserPlus size={16} />
            Add User
          </button>
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
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs font-bold text-amber-800">
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
                setIsTreeExpanded(true);
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

                {onvifAvailable && (
                  <div className="p-2 border rounded-2xl border-navy/5 bg-background/60">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedGroup("onvif");
                        setSelectedUserForAttribute(null);
                        setSelectedUserForPermission(null);
                        toggleGroupExpanded("onvif");
                        setActiveTab("attribute");
                      }}
                      className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left transition-colors ${selectedGroup === "onvif" ? "bg-white text-navy shadow-sm" : "text-navy/60 hover:bg-white hover:text-navy"}`}
                    >
                      <span className="flex items-center gap-2">
                        {isGroupExpanded("onvif") ? (
                          <ChevronDown size={14} />
                        ) : (
                          <ChevronRight size={14} />
                        )}
                        <span className="text-xs font-black tracking-widest uppercase">
                          Onvif
                        </span>
                      </span>
                      <span className="rounded-full bg-navy/5 px-2 py-1 text-[10px] font-black text-navy/50">
                        {onvifUsers.length}
                      </span>
                    </button>

                    {isGroupExpanded("onvif") && (
                      <div className="pl-4 mt-2 space-y-1">
                        {onvifUsers.map((user) => (
                          <button
                            key={`onvif-${user.name}`}
                            type="button"
                            onClick={() => {
                              setSelectedGroup("onvif");
                              setSelectedUserForAttribute(user.name);
                              setSelectedUserForPermission(null);
                              setActiveTab("attribute");
                            }}
                            className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left transition-colors ${selectedGroup === "onvif" && selectedUserForAttribute === user.name ? "bg-white text-navy shadow-sm" : "text-navy/45 hover:bg-white hover:text-navy"}`}
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
                )}
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
                          {onvifAvailable && (
                            <tr className="text-sm text-navy/80">
                              <td className="px-4 py-4 font-medium text-center border-b border-navy/5">
                                Onvif
                              </td>
                              <td className="px-4 py-4 font-medium text-center border-b border-navy/5">
                                {onvifUsers.length}
                              </td>
                            </tr>
                          )}
                          {userGroups.length === 0 && !onvifAvailable && (
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
    </div>
  );
};

export default UserManagement;
