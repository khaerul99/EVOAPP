import React from 'react';
import {
    Loader2,
    AlertCircle,
    Eye,
    EyeOff,
} from 'lucide-react';
import { usePermissionManagement } from '../../hooks/user/usePermissionManagement';

function PermissionCheckbox({ checked, label, onChange, disabled = false }) {
    return (
        <label className="flex items-center gap-2 text-sm text-navy/55">
            <input
                type="checkbox"
                checked={checked}
                disabled={disabled}
                onChange={(event) => onChange?.(event.target.checked)}
                className={`h-4 w-4 rounded-sm border-gray-300 bg-gray-100 accent-gray-300 ${disabled ? 'cursor-not-allowed text-gray-400' : 'cursor-pointer text-gray-500'}`}
            />
            <span className="leading-none">{label}</span>
        </label>
    );
}

const PermissionManagement = ({ userName, groupName = "", authoritiesOverride = [] }) => {
    const {
        loading,
        error,
        draftPermissionState,
        channels,
        saving,
        saveError,
        saveSuccessMessage,
        canEdit,
        hasUnsavedChanges,
        PERMISSION_CATEGORIES,
        togglePermission,
        toggleSectionPermissions,
        toggleChannelPermission,
        toggleAllChannelPermissions,
        applyPermissionChanges,
        setSaveError,
        loadPermissionData,
    } = usePermissionManagement(userName, groupName, authoritiesOverride);
    const [isAuthOpen, setIsAuthOpen] = React.useState(false);
    const [authPassword, setAuthPassword] = React.useState('');
    const [authMessage, setAuthMessage] = React.useState('');
    const [showPassword, setShowPassword] = React.useState(false);
    const [showAllChannels, setShowAllChannels] = React.useState(false);
    const [channelPage, setChannelPage] = React.useState(1);
    const [channelsPerPage, setChannelsPerPage] = React.useState(20);
    const isUserNode = Boolean(String(userName || '').trim());

    const onApplyClick = () => {
        setAuthPassword('');
        setAuthMessage('');
        setSaveError('');
        setIsAuthOpen(true);
    };

    const onRefreshClick = async () => {
        setSaveError('');
        setAuthMessage('');
        await loadPermissionData();
    };

    const onConfirmApply = async (event) => {
        event.preventDefault();
        try {
            await applyPermissionChanges(authPassword);
            setIsAuthOpen(false);
            setAuthPassword('');
            setAuthMessage('');
        } catch (applyError) {
            setAuthMessage(String(applyError?.message || 'Gagal menyimpan permission.'));
        }
    };

    const allChannels = React.useMemo(() => {
        const normalized = Array.isArray(channels)
            ? [...channels]
                .map((channel) => ({
                    id: Number(channel?.id),
                    name: String(channel?.name || '').trim(),
                }))
                .filter((channel) => Number.isFinite(channel.id) && channel.id > 0)
                .sort((left, right) => left.id - right.id)
            : [];

        if (!showAllChannels) {
            return normalized;
        }

        const maxExistingId = normalized.reduce((max, channel) => Math.max(max, channel.id), 0);
        const targetCount = Math.max(maxExistingId, 64);
        const byId = new Map(normalized.map((channel) => [channel.id, channel]));

        return Array.from({ length: targetCount }, (_, index) => {
            const id = index + 1;
            const existing = byId.get(id);
            return {
                id,
                // Keep naming consistent with master-style Show All:
                // only the first contiguous discovered channels use real names,
                // the rest fall back to Channel{n}.
                name: existing && id <= normalized.length ? existing.name : `Channel${id}`,
            };
        });
    }, [channels, showAllChannels]);

    const channelTotalPages = Math.max(1, Math.ceil(allChannels.length / channelsPerPage));
    const pagedChannels = React.useMemo(() => {
        const start = (channelPage - 1) * channelsPerPage;
        return allChannels.slice(start, start + channelsPerPage);
    }, [allChannels, channelPage, channelsPerPage]);

    React.useEffect(() => {
        setChannelPage(1);
    }, [showAllChannels, channelsPerPage]);

    React.useEffect(() => {
        if (channelPage > channelTotalPages) {
            setChannelPage(channelTotalPages);
        }
    }, [channelPage, channelTotalPages]);

    if (
        !userName
        && !groupName
        && (!Array.isArray(authoritiesOverride) || authoritiesOverride.length === 0)
    ) {
        return (
            <div className="px-2 py-4 text-sm text-navy/40">
                Pilih user dari tree di sebelah kiri untuk mengatur permission.
            </div>
        );
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center p-8">
                <div className="inline-flex items-center gap-2 text-xs font-bold text-navy/50">
                    <Loader2 size={16} className="animate-spin" />
                    Memuat data permission...
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {error && (
                <div className="flex items-center gap-3 p-3 border rounded-md border-danger/20 bg-danger/10 text-danger">
                    <AlertCircle size={16} className="flex-shrink-0" />
                    <p className="text-xs">{error}</p>
                </div>
            )}
            {saveError && (
                <div className="flex items-center gap-3 p-3 border rounded-md border-danger/20 bg-danger/10 text-danger">
                    <AlertCircle size={16} className="flex-shrink-0" />
                    <p className="text-xs">{saveError}</p>
                </div>
            )}
            {saveSuccessMessage && (
                <div className="p-3 text-xs font-semibold border rounded-md border-emerald-200 bg-emerald-50 text-emerald-700">
                    {saveSuccessMessage}
                </div>
            )}
        
            <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1fr_1fr_1fr_1.75fr]">
                {['config', 'operation', 'control'].map((sectionKey) => {
                    const section = PERMISSION_CATEGORIES[sectionKey];
                    const sectionAllChecked = section.permissions.length > 0
                        && section.permissions.every((permission) => Boolean(draftPermissionState[sectionKey]?.[permission]));

                    return (
                        <div key={sectionKey} className="bg-white border border-navy/10">
                            <div className="px-4 py-3 text-lg font-semibold text-navy/90">{section.label}</div>
                            <div className="px-4 py-3 space-y-3 border-t border-navy/10">
                                <PermissionCheckbox
                                    label="Select All"
                                    checked={sectionAllChecked}
                                    onChange={(checked) => toggleSectionPermissions(sectionKey, checked)}
                                    disabled={!canEdit}
                                />
                                {section.permissions.map((permission) => (
                                    <PermissionCheckbox
                                        key={permission}
                                        label={permission}
                                        checked={Boolean(draftPermissionState[sectionKey]?.[permission])}
                                        onChange={(checked) => togglePermission(sectionKey, permission, checked)}
                                        disabled={!canEdit}
                                    />
                                ))}
                            </div>
                        </div>
                    );
                })}

                <div className="bg-white border border-navy/10">
                    <div className="flex items-center justify-between px-4 py-3">
                        <div className="flex items-center gap-4">
                            <h3 className="text-lg font-semibold text-navy/90">Channel</h3>
                            <label className="inline-flex items-center gap-2 text-sm font-medium text-navy/70">
                                <span>Show All</span>
                                <button
                                    type="button"
                                    role="switch"
                                    aria-checked={showAllChannels}
                                    onClick={() => setShowAllChannels((prev) => !prev)}
                                    className={`relative h-6 w-10 rounded-full transition-colors ${showAllChannels ? 'bg-sky-500' : 'bg-navy/25'}`}
                                >
                                    <span
                                        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${showAllChannels ? '-translate-x-0.5' : '-translate-x-4'}`}
                                    />
                                </button>
                            </label>
                        </div>
                    </div>

                    <div className="px-4 py-3 space-y-3 border-t border-navy/10">
                        <PermissionCheckbox
                            label="Select All"
                            checked={
                                pagedChannels.length > 0
                                && pagedChannels.every((channel) => (
                                    Boolean(draftPermissionState[`channel_${channel.id}`]?.Live)
                                    && Boolean(draftPermissionState[`channel_${channel.id}`]?.Playback)
                                ))
                            }
                            onChange={(checked) =>
                                toggleAllChannelPermissions(
                                    pagedChannels.map((channel) => channel.id),
                                    checked,
                                )
                            }
                            disabled={!canEdit}
                        />
                        <div className="grid grid-cols-[1.7fr_1fr_1fr] text-sm text-navy/60">
                            <div>Channel</div>
                            <div className="text-left">Live</div>
                            <div className="text-left">Playback</div>
                        </div>

                        {pagedChannels.map((channel) => (
                            <div key={channel.id} className="grid grid-cols-[1.7fr_1fr_1fr] items-start text-sm text-navy/60">
                                <div>{channel.id}-{channel.name}</div>
                                <PermissionCheckbox
                                    label=""
                                    checked={Boolean(draftPermissionState[`channel_${channel.id}`]?.Live)}
                                    onChange={(checked) => toggleChannelPermission(channel.id, 'Live', checked)}
                                    disabled={!canEdit}
                                />
                                <PermissionCheckbox
                                    label=""
                                    checked={Boolean(draftPermissionState[`channel_${channel.id}`]?.Playback)}
                                    onChange={(checked) => toggleChannelPermission(channel.id, 'Playback', checked)}
                                    disabled={!canEdit}
                                />
                            </div>
                        ))}

                        <div className="flex items-center justify-between gap-3 pt-1 text-sm text-navy/80">
                            <span>Total {allChannels.length} items</span>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => setChannelPage((prev) => Math.max(1, prev - 1))}
                                    disabled={channelPage <= 1}
                                    className="px-2 py-1 text-xs border rounded border-navy/20 text-navy/70 disabled:opacity-40"
                                >
                                    &lt;
                                </button>
                                <span className="text-xs text-center min-w-6">{channelPage}</span>
                                <button
                                    type="button"
                                    onClick={() => setChannelPage((prev) => Math.min(channelTotalPages, prev + 1))}
                                    disabled={channelPage >= channelTotalPages}
                                    className="px-2 py-1 text-xs border rounded border-navy/20 text-navy/70 disabled:opacity-40"
                                >
                                    &gt;
                                </button>
                                <select
                                    value={channelsPerPage}
                                    onChange={(event) => setChannelsPerPage(Number(event.target.value))}
                                    className="px-2 py-1 text-xs border rounded border-navy/20 text-navy/70"
                                >
                                    <option value={20}>20 / page</option>
                                    <option value={32}>32 / page</option>
                                    <option value={64}>64 / page</option>
                                </select>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            {canEdit && (
                <div className="flex items-center gap-2 pt-1">
                    <button
                        type="button"
                        onClick={onApplyClick}
                        disabled={!hasUnsavedChanges || saving}
                        className="px-4 py-2 text-xs font-bold text-white rounded bg-navy disabled:opacity-40"
                    >
                        {saving ? 'Saving...' : 'Apply'}
                    </button>
                    <button
                        type="button"
                        onClick={onRefreshClick}
                        disabled={loading || saving}
                        className="px-4 py-2 text-xs font-bold border rounded border-navy/20 text-navy/70 disabled:opacity-40"
                    >
                        Refresh
                    </button>
                </div>
            )}

            {isAuthOpen && (
                <div className="fixed top-[-40px] left-0 right-0 bottom-0 z-[110] min-h-screen w-screen flex items-center justify-center bg-navy/30 p-4 backdrop-blur-sm">
                    <div className="w-full max-w-xl p-6 bg-white border shadow-2xl rounded-3xl border-navy/10 md:p-8">
                        <h3 className="mb-2 text-sm font-black tracking-widest uppercase text-navy">
                            Authentication Password
                        </h3>
                        <p className="mb-6 text-[11px] font-semibold text-navy/50">
                            Masukkan password akun aktif untuk menyimpan perubahan permission.
                        </p>
                        {authMessage && (
                            <div className="mb-4 rounded-2xl border border-danger/20 bg-danger/10 px-4 py-3 text-[11px] font-bold text-danger">
                                {authMessage}
                            </div>
                        )}
                        <form onSubmit={onConfirmApply} className="space-y-4" autoComplete="off" noValidate>
                            <div className="relative">
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={authPassword}
                                    onChange={(event) => setAuthPassword(event.target.value)}
                                    placeholder="password"
                                    className="w-full px-4 py-3 pr-12 text-xs font-bold bg-white border outline-none rounded-xl border-navy/15 text-navy focus:border-navy/30"
                                    autoComplete="new-password"
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword((previous) => !previous)}
                                    className="absolute -translate-y-1/2 right-3 top-1/2 text-navy/50"
                                >
                                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                            </div>
                            <div className="flex items-center justify-end gap-2 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setIsAuthOpen(false)}
                                    className="px-4 py-2 text-xs font-black tracking-widest uppercase border rounded-xl border-navy/10 text-navy/70"
                                    disabled={saving}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="inline-flex items-center px-4 py-2 text-xs font-black tracking-widest text-white uppercase rounded-xl bg-navy disabled:opacity-60"
                                    disabled={saving}
                                >
                                    {saving && <Loader2 size={14} className="mr-2 animate-spin" />}
                                    OK
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PermissionManagement;
