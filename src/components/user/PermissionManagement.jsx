import React from 'react';
import {
    Loader2,
    AlertCircle,
} from 'lucide-react';
import { usePermissionManagement } from '../../hooks/user/usePermissionManagement';

function PermissionCheckbox({ checked, label }) {
    return (
        <label className="flex items-center gap-2 text-sm text-navy/55">
            <input
                type="checkbox"
                checked={checked}
                disabled
                className="h-4 w-4 rounded-sm border-gray-300 bg-gray-100 text-gray-400 accent-gray-300 cursor-not-allowed"
            />
            <span className="leading-none">{label}</span>
        </label>
    );
}

const PermissionManagement = ({ userName }) => {
    const {
        loading,
        error,
        permissionState,
        channels,
        PERMISSION_CATEGORIES,
        loadPermissionData,
    } = usePermissionManagement(userName);

    if (!userName) {
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

            <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1fr_1fr_1fr_1.75fr]">
                {['config', 'operation', 'control'].map((sectionKey) => {
                    const section = PERMISSION_CATEGORIES[sectionKey];

                    return (
                        <div key={sectionKey} className="border border-navy/10 bg-white">
                            <div className="px-4 py-3 text-lg font-semibold text-navy/90">{section.label}</div>
                            <div className="border-t border-navy/10 px-4 py-3 space-y-3">
                                {section.permissions.map((permission) => (
                                    <PermissionCheckbox
                                        key={permission}
                                        label={permission}
                                        checked={Boolean(permissionState[sectionKey]?.[permission])}
                                    />
                                ))}
                            </div>
                        </div>
                    );
                })}

                <div className="border border-navy/10 bg-white">
                    <div className="flex items-center justify-between px-4 py-3">
                        <h3 className="text-lg font-semibold text-navy/90">Channel</h3>
                    </div>

                    <div className="border-t border-navy/10 px-4 py-3 space-y-3">
                        <div className="grid grid-cols-[1.7fr_1fr_1fr] text-sm text-navy/60">
                            <div>Channel</div>
                            <div className="text-left">Live</div>
                            <div className="text-left">Playback</div>
                        </div>

                        {channels.map((channel) => (
                            <div key={channel.id} className="grid grid-cols-[1.7fr_1fr_1fr] items-start text-sm text-navy/60">
                                <div>{channel.id}-{channel.name}</div>
                                <PermissionCheckbox
                                    label=""
                                    checked={Boolean(permissionState[`channel_${channel.id}`]?.Live)}
                                />
                                <PermissionCheckbox
                                    label=""
                                    checked={Boolean(permissionState[`channel_${channel.id}`]?.Playback)}
                                />
                            </div>
                        ))}

                        <div className="pt-1 text-sm text-navy/80">Total {channels.length} items</div>
                    </div>
                </div>
            </div>

        
        </div>
    );
};

export default PermissionManagement;
