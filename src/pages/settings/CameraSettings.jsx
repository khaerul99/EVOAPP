import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, RefreshCcw, Settings2, Trash2 } from "lucide-react";
import { useStore } from "../../stores/useStore";
import { MENU_CONFIG } from "../../lib/camera-settings.config";
import { cameraSettingsService } from "../../services/camera/camera-settings.service";

function Switch({ checked, onChange }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-7 w-14 items-center rounded-full border transition-all ${checked ? "border-sky-500 bg-sky-500" : "border-slate-300 bg-slate-300"}`}
      aria-pressed={checked}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white transition-all ${checked ? "translate-x-8" : "translate-x-1"}`}
      />
    </button>
  );
}

const CameraSettings = () => {
  const activeChannel = useStore((state) => state.activeChannel);
  const onlineChannels = useStore((state) => state.onlineChannels);
  const isLoadingChannels = useStore((state) => state.isLoadingChannels);
  const channelError = useStore((state) => state.channelError);
  const activeMenu = useStore((state) => state.activeMenu);
  const isBootstrapped = useStore((state) => state.isBootstrapped);
  const initializeAfterLogin = useStore((state) => state.initializeAfterLogin);
  const setActiveChannel = useStore((state) => state.setActiveChannel);
  const setActiveMenu = useStore((state) => state.setActiveMenu);
  const startRealtimePolling = useStore((state) => state.startRealtimePolling);
  const stopRealtimePolling = useStore((state) => state.stopRealtimePolling);
  const [peopleTab, setPeopleTab] = useState("People Counting");
  const [peopleConfig, setPeopleConfig] = useState({
    channelIndex: 0,
    sourceName: "",
    diagnostics: [],
    globalEnabled: false,
    moduleEnabled: false,
    rules: [],
    stats: {},
  });
  const [peopleLoading, setPeopleLoading] = useState(false);
  const [peopleError, setPeopleError] = useState("");
  const [addRuleOpen, setAddRuleOpen] = useState(false);
  const [smartMotionConfig, setSmartMotionConfig] = useState({
    channelIndex: 0,
    enabled: false,
    sensitivity: "",
    objectTypes: {
      human: false,
      vehicle: false,
    },
  });
  const [smartMotionLoading, setSmartMotionLoading] = useState(false);
  const [smartMotionError, setSmartMotionError] = useState("");
  const [smartMotionDraft, setSmartMotionDraft] = useState({
    enabled: false,
    sensitivity: "Middle",
    objectTypes: {
      human: false,
      vehicle: false,
    },
  });
  const channelIsSelected = Boolean(activeChannel);

  useEffect(() => {
    if (!isBootstrapped) {
      initializeAfterLogin();
    }
  }, [initializeAfterLogin, isBootstrapped]);

  const activeConfig = useMemo(() => {
    return (
      MENU_CONFIG.find((item) => item.key === activeMenu) || MENU_CONFIG[0]
    );
  }, [activeMenu]);

  const selectedChannel = useMemo(() => {
    return (
      onlineChannels.find((channel) => channel.id === activeChannel) || null
    );
  }, [activeChannel, onlineChannels]);

  const selectedChannelLabel = selectedChannel?.label || "-";

  const formatPeopleRuleType = (ruleType) => {
    const normalized = String(ruleType || "").trim().toLowerCase();
    if (!normalized) {
      return "People Counting";
    }
    if (normalized.includes("numberstat")) {
      return "People Counting";
    }
    return String(ruleType);
  };

  useEffect(() => {
    if (!activeChannel || !activeConfig?.eventCodes?.length) {
      stopRealtimePolling();
      return;
    }

    startRealtimePolling(activeConfig.eventCodes);

    return () => {
      stopRealtimePolling();
    };
  }, [activeChannel, activeConfig, startRealtimePolling, stopRealtimePolling]);

  const reloadPeopleConfig = useCallback(async ({ showLoading = true } = {}) => {
    if (!channelIsSelected || activeConfig?.panelType !== "peopleCounting") {
      return;
    }
    const channelNumber =
      parseInt(String(activeChannel).replace(/\D/g, "")) || 1;
    if (showLoading) {
      setPeopleLoading(true);
    }
    try {
      const [result, statsData] = await Promise.all([
        cameraSettingsService.getPeopleCountingConfig(channelNumber, {
          exhaustiveProbe: true,
        }),
        cameraSettingsService.getPeopleCountingStats(channelNumber),
      ]);

      const enrichedRules = (Array.isArray(result?.rules) ? result.rules : []).map((rule) => ({
        ...rule,
        entered: statsData?.entered || 0,
        exited: statsData?.exited || 0,
        inside: statsData?.inside || 0,
      }));

      setPeopleConfig((prev) => ({
        ...prev,
        channelIndex: Number.isFinite(Number(result?.channelIndex))
          ? Number(result.channelIndex)
          : Math.max(channelNumber - 1, 0),
        sourceName: String(result?.sourceName || ""),
        diagnostics: Array.isArray(result?.diagnostics) ? result.diagnostics : [],
        rules: enrichedRules,
        globalEnabled: Boolean(result?.globalEnabled),
        moduleEnabled: Boolean(result?.moduleEnabled),
        stats: {
          entered: statsData?.entered || 0,
          exited: statsData?.exited || 0,
          inside: statsData?.inside || 0,
        },
      }));
      setPeopleError("");
    } catch {
      setPeopleError("Gagal sinkronisasi dengan kamera.");
    } finally {
      if (showLoading) {
        setPeopleLoading(false);
      }
    }
  }, [activeChannel, activeConfig?.panelType, channelIsSelected]);

  useEffect(() => {
    if (!channelIsSelected || activeConfig?.panelType !== "peopleCounting") {
      return;
    }
    reloadPeopleConfig({ showLoading: true });
  }, [activeChannel, activeConfig, channelIsSelected, reloadPeopleConfig]);

  const reloadSmartMotionConfig = useCallback(async ({ showLoading = true } = {}) => {
    if (!channelIsSelected || activeConfig?.key !== "smartMotion") {
      return;
    }
    const channelNumber =
      parseInt(String(activeChannel).replace(/\D/g, "")) || 1;
    if (showLoading) {
      setSmartMotionLoading(true);
    }
    try {
      const result = await cameraSettingsService.getSmartMotionConfig(channelNumber);
      setSmartMotionConfig({
        channelIndex: Number.isFinite(Number(result?.channelIndex))
          ? Number(result.channelIndex)
          : Math.max(channelNumber - 1, 0),
        enabled: Boolean(result?.enabled),
        sensitivity: String(result?.sensitivity || ""),
        objectTypes: {
          human: Boolean(result?.objectTypes?.human),
          vehicle: Boolean(result?.objectTypes?.vehicle),
        },
      });
      setSmartMotionDraft({
        enabled: Boolean(result?.enabled),
        sensitivity: String(result?.sensitivity || "Middle"),
        objectTypes: {
          human: Boolean(result?.objectTypes?.human),
          vehicle: Boolean(result?.objectTypes?.vehicle),
        },
      });
      setSmartMotionError("");
    } catch {
      setSmartMotionError("Gagal mengambil config Smart Motion.");
    } finally {
      if (showLoading) {
        setSmartMotionLoading(false);
      }
    }
  }, [activeChannel, activeConfig?.key, channelIsSelected]);

  useEffect(() => {
    if (!channelIsSelected || activeConfig?.key !== "smartMotion") {
      return;
    }
    reloadSmartMotionConfig({ showLoading: true });
  }, [activeChannel, activeConfig?.key, channelIsSelected, reloadSmartMotionConfig]);

  const handleTogglePeopleEnable = async (nextValue) => {
    if (!channelIsSelected) {
      return;
    }
    const channelNumber = Number(String(activeChannel).replace("ch", ""));
    setPeopleLoading(true);
    setPeopleError("");
    try {
      await cameraSettingsService.setPeopleCountingEnable({
        channelId: channelNumber,
        enabled: nextValue,
        channelIndexOverride: peopleConfig.channelIndex,
      });
      await reloadPeopleConfig();
    } catch {
      setPeopleError("Gagal update enable People Counting.");
    } finally {
      setPeopleLoading(false);
    }
  };

  const handleTogglePeopleRuleEnable = async (rule, nextValue) => {
    if (!channelIsSelected) {
      return;
    }

    const channelNumber = Number(String(activeChannel).replace("ch", ""));
    const targetRuleIndex = Number(rule?.index);
    if (!Number.isFinite(targetRuleIndex) || targetRuleIndex < 0) {
      setPeopleError("Rule index tidak valid.");
      return;
    }

    setPeopleLoading(true);
    setPeopleError("");
    try {
      await cameraSettingsService.setPeopleCountingRuleEnable({
        channelId: channelNumber,
        ruleIndex: targetRuleIndex,
        enabled: nextValue,
        channelIndexOverride: peopleConfig.channelIndex,
      });
      await reloadPeopleConfig();
    } catch {
      setPeopleError("Gagal update status rule People Counting.");
    } finally {
      setPeopleLoading(false);
    }
  };

  const handleAddPeopleRule = async (ruleKind) => {
    if (!channelIsSelected) {
      return;
    }
    const channelNumber = Number(String(activeChannel).replace("ch", ""));
    setPeopleLoading(true);
    setPeopleError("");
    setAddRuleOpen(false);
    try {
      const ruleName =
        ruleKind === "area" ? "Area People Counting" : "People Counting";
      await cameraSettingsService.addPeopleCountingRule({
        channelId: channelNumber,
        name: ruleName,
        channelIndexOverride: peopleConfig.channelIndex,
        existingRuleIndexes: (peopleConfig.rules || [])
          .map((rule) => Number(rule?.index))
          .filter((value) => Number.isFinite(value) && value >= 0),
      });
      await reloadPeopleConfig();
    } catch {
      setPeopleError("Gagal menambahkan rule People Counting.");
    } finally {
      setPeopleLoading(false);
    }
  };

  const handleDeletePeopleRule = async (rule) => {
    if (!channelIsSelected) {
      return;
    }

    const channelNumber = Number(String(activeChannel).replace("ch", ""));
    const targetRuleIndex = Number(rule?.index);
    if (!Number.isFinite(targetRuleIndex) || targetRuleIndex < 0) {
      setPeopleError("Rule index tidak valid.");
      return;
    }

    setPeopleLoading(true);
    setPeopleError("");
    try {
      await cameraSettingsService.deletePeopleCountingRule({
        channelId: channelNumber,
        ruleIndex: targetRuleIndex,
        channelIndexOverride: peopleConfig.channelIndex,
      });
      await reloadPeopleConfig();
    } catch {
      setPeopleError("Gagal menghapus rule People Counting.");
    } finally {
      setPeopleLoading(false);
    }
  };

  const handleToggleSmartMotionEnable = async (nextValue) => {
    setSmartMotionDraft((prev) => ({ ...prev, enabled: nextValue }));
  };

  const handleSaveSmartMotionConfig = async () => {
    if (!channelIsSelected) {
      return;
    }
    const channelNumber = Number(String(activeChannel).replace("ch", ""));
    setSmartMotionLoading(true);
    setSmartMotionError("");
    try {
      await cameraSettingsService.setSmartMotionConfig({
        channelId: channelNumber,
        channelIndexOverride: smartMotionConfig.channelIndex,
        enabled: Boolean(smartMotionDraft.enabled),
        sensitivity: smartMotionDraft.sensitivity,
        objectTypes: smartMotionDraft.objectTypes,
      });
      await reloadSmartMotionConfig({ showLoading: false });
    } catch {
      setSmartMotionError("Gagal menyimpan config Smart Motion.");
    } finally {
      setSmartMotionLoading(false);
    }
  };

  const handleCancelSmartMotionChanges = () => {
    setSmartMotionDraft({
      enabled: Boolean(smartMotionConfig.enabled),
      sensitivity: String(smartMotionConfig.sensitivity || "Middle"),
      objectTypes: {
        human: Boolean(smartMotionConfig.objectTypes?.human),
        vehicle: Boolean(smartMotionConfig.objectTypes?.vehicle),
      },
    });
    setSmartMotionError("");
  };

  const isSmartMotionDirty = useMemo(() => {
    return (
      Boolean(smartMotionDraft.enabled) !== Boolean(smartMotionConfig.enabled)
      || String(smartMotionDraft.sensitivity || "Middle") !== String(smartMotionConfig.sensitivity || "Middle")
      || Boolean(smartMotionDraft.objectTypes?.human) !== Boolean(smartMotionConfig.objectTypes?.human)
      || Boolean(smartMotionDraft.objectTypes?.vehicle) !== Boolean(smartMotionConfig.objectTypes?.vehicle)
    );
  }, [smartMotionDraft, smartMotionConfig]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-xl border border-navy/10 bg-white px-3 py-1.5">
            <Settings2 size={14} className="text-navy/70" />
            <span className="text-xs font-black tracking-widest uppercase text-navy/60">
              Camera Setting
            </span>
          </div>
          <h1 className="mt-3 text-2xl font-black text-navy">
            Data & Control Template
          </h1>
          <p className="mt-1 text-sm text-navy/55">
            Pilih channel dulu, lalu atur bagian Data atau Control untuk channel
            tersebut.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() =>
              activeConfig?.panelType === "peopleCounting"
                ? reloadPeopleConfig()
                : activeConfig?.key === "smartMotion"
                  ? reloadSmartMotionConfig()
                  : null
            }
            disabled={
              !channelIsSelected
              || (activeConfig?.panelType !== "peopleCounting" && activeConfig?.key !== "smartMotion")
            }
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-bold bg-white border rounded-xl border-navy/10 text-navy/75 hover:bg-slate-50"
          >
            <RefreshCcw size={16} />
            Refresh API
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="p-3 bg-white border rounded-2xl border-navy/10">
          <p className="px-2 pb-2 text-[10px] font-black uppercase tracking-widest text-navy/45">
            Channel List
          </p>
          <div className="pb-4 space-y-1">
            {isLoadingChannels && (
              <div className="px-3 py-2 text-xs font-semibold border rounded-xl border-navy/10 bg-slate-50 text-navy/60">
                Loading online camera...
              </div>
            )}

            {!isLoadingChannels && onlineChannels.length === 0 && (
              <div className="px-3 py-2 text-xs font-semibold border rounded-xl border-amber-200 bg-amber-50 text-amber-700">
                Tidak ada kamera online.
              </div>
            )}

            {!isLoadingChannels &&
              onlineChannels.map((channel) => {
                const selected = activeChannel === channel.id;
                return (
                  <button
                    key={channel.id}
                    type="button"
                    onClick={() => setActiveChannel(channel.id)}
                    className={`w-full rounded-xl border px-3 py-2.5 text-left text-sm font-bold transition-all ${selected ? "border-sky-300 bg-sky-50 text-navy" : "border-transparent bg-white text-navy/70 hover:border-navy/10 hover:bg-slate-50"}`}
                  >
                    <p>{channel.label}</p>
                    <p className="mt-0.5 text-[10px] font-semibold text-navy/50">
                      {channel.ip}
                    </p>
                  </button>
                );
              })}
          </div>

          <p className="border-t border-navy/10 px-2 pb-2 pt-4 text-[10px] font-black uppercase tracking-widest text-navy/45">
            Menu List
          </p>
          <div className="space-y-1">
            {MENU_CONFIG.map((menu) => {
              const selected = activeMenu === menu.key;
              return (
                <button
                  key={menu.key}
                  type="button"
                  onClick={() => setActiveMenu(menu.key)}
                  disabled={!channelIsSelected}
                  className={`w-full rounded-xl border px-3 py-2.5 text-left transition-all ${selected ? "border-sky-300 bg-sky-50" : "border-transparent bg-white hover:border-navy/10 hover:bg-slate-50"} disabled:cursor-not-allowed disabled:opacity-50`}
                >
                  <p className="text-sm font-bold text-navy">{menu.title}</p>
                  <p className="mt-0.5 text-[11px] text-navy/55">
                    {menu.subtitle}
                  </p>
                </button>
              );
            })}
          </div>
        </aside>

        <section className="relative pb-20 p-5 bg-white border rounded-2xl border-navy/10">
          {!channelIsSelected && (
            <div className="px-4 py-3 mb-4 text-sm font-semibold border rounded-xl border-amber-200 bg-amber-50 text-amber-700">
              Pilih channel terlebih dahulu untuk membuka pengaturan.
            </div>
          )}
          {channelError && (
            <div className="px-4 py-3 mb-4 text-sm font-semibold border rounded-xl border-danger/20 bg-danger/10 text-danger">
              {channelError}
            </div>
          )}

          <div className="flex flex-col gap-3 pb-4 mb-4 border-b border-navy/10 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-navy/45">
                Active Channel
              </p>
              <h2 className="mt-1 text-base font-black text-navy">
                {selectedChannelLabel}
              </h2>
              <p className="mt-2 text-[10px] font-black uppercase tracking-widest text-navy/45">
                Active Menu
              </p>
              <h2 className="mt-1 text-lg font-black text-navy">
                {activeConfig.title}
              </h2>
            </div>

            <div />
          </div>

      
          {activeConfig?.panelType !== "peopleCounting" && activeConfig?.key !== "smartMotion" && (
            <div className="px-4 py-3 mb-4 bg-white border rounded-xl border-navy/10">
              <p className="text-sm font-semibold text-navy/70">
                Data menu ini hanya ditampilkan jika endpoint API tersedia.
              </p>
              <p className="mt-1 text-xs font-semibold text-navy/55">
                Saat ini fallback data statis dinonaktifkan.
              </p>
            </div>
          )}

          {activeConfig?.panelType !== "peopleCounting" && activeConfig?.key !== "smartMotion" && (
            <div className="flex items-center justify-between px-4 py-3 mb-4 border rounded-xl border-navy/10 bg-slate-50">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-navy/45">
                  Enable
                </p>
                <p className="text-sm font-semibold text-navy/70">
                  Belum ada endpoint config khusus untuk menu ini.
                </p>
              </div>
              <Switch checked={false} onChange={() => {}} />
            </div>
          )}

          {activeConfig?.panelType === "peopleCounting" ? (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {(activeConfig.peopleTabs || []).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setPeopleTab(tab)}
                    className={`rounded-lg border px-4 py-2 text-sm ${peopleTab === tab ? "border-sky-400 bg-sky-50 text-sky-700" : "border-navy/15 bg-white text-navy/70"}`}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              <div className="flex items-center justify-between px-4 py-3 border rounded-xl border-navy/10 bg-slate-50">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-navy/45">
                    Enable
                  </p>
                  <p className="text-sm font-semibold text-navy/70">
                    Global + Module Enable (configManager setConfig)
                  </p>
                </div>
                <Switch
                  checked={Boolean(peopleConfig.globalEnabled)}
                  onChange={handleTogglePeopleEnable}
                />
              </div>

              <div className="relative inline-block">
                <button
                  type="button"
                  onClick={() => setAddRuleOpen((value) => !value)}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-bold text-white rounded-lg bg-sky-600"
                >
                  Add Rule
                  <ChevronDown size={14} />
                </button>
                {addRuleOpen && (
                  <div className="absolute z-10 w-48 p-1 mt-2 bg-white border rounded-lg shadow-xl border-navy/10">
                    <button
                      type="button"
                      onClick={() => handleAddPeopleRule("area")}
                      className="w-full px-3 py-2 text-sm text-left rounded-md hover:bg-slate-50"
                    >
                      Area People Counting
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddPeopleRule("people")}
                      className="w-full px-3 py-2 text-sm text-left rounded-md hover:bg-slate-50"
                    >
                      People Counting
                    </button>
                  </div>
                )}
              </div>

              <div className="overflow-hidden border rounded-xl border-navy/10">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-4 py-3 font-black text-left text-navy/70">
                        No.
                      </th>
                      <th className="px-4 py-3 font-black text-left text-navy/70">
                        Name
                      </th>
                      <th className="px-4 py-3 font-black text-left text-navy/70">
                        Rule Type
                      </th>
                      <th className="px-4 py-3 font-black text-left text-navy/70">
                        Operation
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {!peopleLoading && peopleConfig.rules.length === 0 && (
                      <tr>
                        <td
                          colSpan={4}
                          className="px-4 py-12 text-center text-navy/50"
                        >
                          No Data
                        </td>
                      </tr>
                    )}
                    {peopleConfig.rules.map((rule, index) => (
                      <tr
                        key={`${rule.index}-${rule.name}`}
                        className="border-t border-navy/10"
                      >
                        <td className="px-4 py-3 font-bold text-navy/70">
                          {index + 1}
                        </td>
                        <td className="px-4 py-3 font-semibold text-navy">
                          {rule.name}
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-semibold text-navy/80">
                            {formatPeopleRuleType(rule.type)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <Switch
                              checked={Boolean(rule.enabled)}
                              onChange={(nextValue) =>
                                handleTogglePeopleRuleEnable(rule, nextValue)
                              }
                            />
                            <button
                              type="button"
                              className="transition-colors text-navy/50 hover:text-danger"
                              title="Delete rule"
                              onClick={() => handleDeletePeopleRule(rule)}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {peopleError && (
                <p className="text-sm font-semibold text-danger">
                  {peopleError}
                </p>
              )}
            </div>
          ) : activeConfig?.key === "smartMotion" ? (
            <div className="flex min-h-[360px] flex-col gap-4">
              <div className="flex items-center justify-between px-4 py-3 border rounded-xl border-navy/10 bg-slate-50">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-navy/45">
                    Enable
                  </p>
                  <p className="text-sm font-semibold text-navy/70">
                    SmartMotionDetect[{smartMotionConfig.channelIndex}].Enable
                  </p>
                </div>
                <Switch
                  checked={Boolean(smartMotionDraft.enabled)}
                  onChange={handleToggleSmartMotionEnable}
                />
              </div>

              <div className="px-4 py-4 space-y-4 bg-white border rounded-xl border-navy/10">
                <div className="flex items-center gap-3">
                  <p className="min-w-[120px] text-sm font-semibold text-navy/70">
                    Effective Target
                  </p>
                  <label className="inline-flex items-center gap-2 text-sm font-semibold text-navy/80">
                    <input
                      type="checkbox"
                      checked={Boolean(smartMotionDraft.objectTypes.human)}
                      onChange={(event) =>
                        setSmartMotionDraft((prev) => ({
                          ...prev,
                          objectTypes: {
                            ...prev.objectTypes,
                            human: event.target.checked,
                          },
                        }))
                      }
                    />
                    Human
                  </label>
                  <label className="inline-flex items-center gap-2 text-sm font-semibold text-navy/80">
                    <input
                      type="checkbox"
                      checked={Boolean(smartMotionDraft.objectTypes.vehicle)}
                      onChange={(event) =>
                        setSmartMotionDraft((prev) => ({
                          ...prev,
                          objectTypes: {
                            ...prev.objectTypes,
                            vehicle: event.target.checked,
                          },
                        }))
                      }
                    />
                    Vehicle
                  </label>
                </div>

                <div className="flex items-center gap-3">
                  <p className="min-w-[120px] text-sm font-semibold text-navy/70">
                    Sensitivity
                  </p>
                  <select
                    value={smartMotionDraft.sensitivity || "Middle"}
                    onChange={(event) =>
                      setSmartMotionDraft((prev) => ({
                        ...prev,
                        sensitivity: event.target.value,
                      }))
                    }
                    className="min-w-[200px] rounded-lg border border-navy/20 bg-white px-3 py-2 text-sm font-semibold text-navy"
                  >
                    <option value="Low">Low</option>
                    <option value="Middle">Medium</option>
                    <option value="High">High</option>
                  </select>
                </div>

                
              </div>

              {smartMotionLoading && (
                <p className="text-sm font-semibold text-navy/55">
                  Sinkronisasi Smart Motion...
                </p>
              )}
              {smartMotionError && (
                <p className="text-sm font-semibold text-danger">
                  {smartMotionError}
                </p>
              )}

              
            </div>
          ) : (
            <div className="space-y-2">
              <p className="px-4 py-3 text-sm font-semibold border rounded-xl border-navy/10 bg-slate-50 text-navy/60">
                API menu ini belum diimplementasikan.
              </p>
            </div>
          )}

          <div className={`absolute bottom-5 right-5 flex justify-end gap-2 ${activeConfig?.key === "smartMotion" ? "" : "hidden"}`}>
                <button
                  type="button"
                  onClick={handleCancelSmartMotionChanges}
                  disabled={smartMotionLoading || !isSmartMotionDirty}
                  className="px-4 py-2 text-sm font-bold border rounded-lg border-navy/20 text-navy/70 disabled:opacity-60"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleSaveSmartMotionConfig}
                  disabled={smartMotionLoading || !isSmartMotionDirty}
                  className="px-4 py-2 text-sm font-bold text-white rounded-lg bg-sky-600 disabled:opacity-60"
                >
                  Save
                </button>
              </div>
        </section>
        
      </div>
    </div>
  );
};

export default CameraSettings;
