import ApiClient from "../../lib/api";
import { warmupDigestChallenge } from "../auth/digest-warmup.service";

const PEOPLE_COUNTING_LOG_PREFIX = "[people-counting-endpoint]";

function logPeopleCountingEndpoint(message, payload) {
  console.log(`${PEOPLE_COUNTING_LOG_PREFIX} ${message}`, payload);
}

function logPeopleCountingEndpointError(message, payload) {
  console.error(`${PEOPLE_COUNTING_LOG_PREFIX} ${message}`, payload);
}

function toEndpointPreview(response) {
  return {
    status: Number(response?.status || 0),
    data: response?.data,
    headers: response?.headers || {},
    contentType: String(response?.headers?.["content-type"] || response?.headers?.["Content-Type"] || ""),
  };
}

function parseKeyValuePayload(rawData) {
  const payload = typeof rawData === "string" ? rawData : String(rawData || "");
  const normalizedPayload = payload.replace(/\\r\\n/g, "\n").replace(/\\n/g, "\n");
  const output = {};
  const lines = normalizedPayload
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  lines.forEach((line) => {
    const separatorIndex = line.indexOf("=");
    if (separatorIndex < 0) {
      return;
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();
    if (!key) {
      return;
    }

    output[key] = value;
  });

  return output;
}

function flattenObjectToDotNotation(input, prefix = "", output = {}) {
  if (input === null || input === undefined) {
    return output;
  }

  if (Array.isArray(input)) {
    input.forEach((value, index) => {
      const nextPrefix = prefix ? `${prefix}[${index}]` : `[${index}]`;
      flattenObjectToDotNotation(value, nextPrefix, output);
    });
    return output;
  }

  if (typeof input !== "object") {
    if (prefix) {
      output[prefix] = input;
    }
    return output;
  }

  Object.entries(input).forEach(([key, value]) => {
    const nextPrefix = prefix ? `${prefix}.${key}` : key;
    flattenObjectToDotNotation(value, nextPrefix, output);
  });

  return output;
}

function normalizeJsonConfigObject(rawData) {
  if (!rawData || typeof rawData !== "object" || Array.isArray(rawData)) {
    return null;
  }

  return flattenObjectToDotNotation(rawData);
}

function isErrorPayload(rawData) {
  return /^error\s*:/i.test(String(rawData || "").trim());
}

function normalizeConfigKey(key) {
  return String(key || "").replace(/^table\./i, "");
}

function normalizeKeyValueMap(rawMap = {}) {
  return Object.entries(rawMap).reduce((accumulator, [key, value]) => {
    accumulator[normalizeConfigKey(key)] = value;
    return accumulator;
  }, {});
}

function normalizeDahuaConfigMap(rawData) {
  if (rawData && typeof rawData === "object" && !Array.isArray(rawData)) {
    const jsonMap = normalizeJsonConfigObject(rawData);
    if (jsonMap && Object.keys(jsonMap).length > 0) {
      return normalizeKeyValueMap(jsonMap);
    }
  }

  return normalizeKeyValueMap(parseKeyValuePayload(rawData));
}

function isNumberStatConfigObject(rawData) {
  return Boolean(
    rawData &&
    typeof rawData === "object" &&
    !Array.isArray(rawData) &&
    rawData?.params?.NumberStat,
  );
}

function isVideoAnalyseConfigObject(rawData) {
  return Boolean(
    rawData &&
    typeof rawData === "object" &&
    !Array.isArray(rawData) &&
    rawData?.params?.VideoAnalyse,
  );
}

function isVideoAnalyseGlobalConfigObject(rawData) {
  return Boolean(
    rawData &&
    typeof rawData === "object" &&
    !Array.isArray(rawData) &&
    rawData?.params?.VideoAnalyseGlobal,
  );
}

function isVideoAnalyseRuleConfigObject(rawData) {
  return Boolean(
    rawData &&
    typeof rawData === "object" &&
    !Array.isArray(rawData) &&
    rawData?.params?.VideoAnalyseRule,
  );
}

function isVideoAnalyseGlobalSceneConfigObject(rawData) {
  return Boolean(
    rawData &&
    typeof rawData === "object" &&
    !Array.isArray(rawData) &&
    rawData?.params?.VideoAnalyseGlobal,
  );
}

function toBoolean(value) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  return ["1", "true", "on", "enable", "enabled", "yes"].includes(normalized);
}

function toInteger(value, fallback = 0) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeBooleanLike(value) {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();

  if (["1", "true", "yes", "on", "online", "connected", "connect", "active", "ok"].includes(normalized)) {
    return true;
  }

  if (["0", "false", "no", "off", "offline", "loss", "lost", "disconnected", "disconnect", "failed", "error", "inactive"].includes(normalized)) {
    return false;
  }

  return null;
}


function isPeopleCountingRuleType(ruleType) {
  const normalized = String(ruleType || "")
    .trim()
    .toLowerCase();
  if (!normalized) {
    return false;
  }
  return (
    normalized.includes("numberstat") ||
    normalized.includes("peoplecount") ||
    normalized.includes("counting") ||
    normalized.includes("people counting") ||
    normalized.includes("area") ||
    normalized.includes("queue") ||
    normalized.includes("abnormal")
  );
}

function parsePeopleCountingFromNumberStatObject(rawData, preferredIndex = 0) {
  const numberStat = rawData?.params?.NumberStat;
  if (!numberStat || typeof numberStat !== "object") {
    return null;
  }

  const flattened = flattenObjectToDotNotation(numberStat);
  const rules = [];
  const rootEnable = toBoolean(
    numberStat.Enable ?? flattened.Enable ?? "false",
  );
  const rootName = String(
    numberStat.Name || numberStat.RuleName || numberStat.Title || "",
  ).trim();
  const rootType = String(numberStat.Type || numberStat.Class || "").trim();

  Object.entries(numberStat).forEach(([key, value]) => {
    if (!value || typeof value !== "object") {
      return;
    }

    if (
      [
        "Config",
        "EventHandler",
        "TimeSection",
        "Name",
        "Type",
        "Class",
        "Enable",
        "Id",
        "ObjectTypes",
        "PtzPresetId",
        "RelateFace",
        "ZoomChangeDetectTime",
        "ZoomChangeEnable",
      ].includes(key)
    ) {
      return;
    }

    const childName = String(
      value.Name || value.RuleName || value.Title || key,
    ).trim();
    const childType = String(value.Type || value.Class || key || "").trim();
    const childEnabled = toBoolean(
      value.Enable ?? value.enabled ?? flattened[`${key}.Enable`] ?? false,
    );

    if (
      !childName &&
      !childType &&
      !Object.keys(value).some(
        (childKey) => typeof value[childKey] === "object",
      )
    ) {
      return;
    }

    rules.push({
      index: rules.length,
      moduleIndex: 0,
      name: childName || `${key}`,
      enabled: childEnabled,
      type: childType || key || "PeopleCounting",
      raw: value,
    });
  });

  const globalEnabled = rootEnable;
  const moduleEnabled = globalEnabled || rules.some((rule) => rule.enabled);

  return {
    channelIndex: preferredIndex,
    rules,
    globalEnabled,
    moduleEnabled,
    raw: flattened,
    sourceName: rootName || rootType || "params.NumberStat",
    stats: {},
  };
}

function parsePeopleCountingRulesFromMap(rawObj, preferredIndex = 0) {
  const normalized = rawObj || {};
  const indexSet = new Set();
  const rawRuleEntries = [];

  Object.entries(normalized).forEach(([key, value]) => {
    const indexedMatch = key.match(
      /^VideoAnaly(?:se|ze)(?:Rule)?\[(\d+)\](?:\[(\d+)\])?\.(?:Module\[(\d+)\]\.)?Rule\[(\d+)\]\.(.+)$/i,
    );
    if (indexedMatch) {
      const cfgIndex = Number(indexedMatch[1]);
      const moduleIndex = indexedMatch[3] ? Number(indexedMatch[3]) : (indexedMatch[2] ? Number(indexedMatch[2]) : 0);
      const ruleIndex = Number(indexedMatch[4]);
      const field = String(indexedMatch[5] || "").trim();
      if (
        !Number.isFinite(cfgIndex) ||
        !Number.isFinite(moduleIndex) ||
        !Number.isFinite(ruleIndex) ||
        !field
      ) {
        return;
      }

      indexSet.add(cfgIndex);
      rawRuleEntries.push({ cfgIndex, moduleIndex, ruleIndex, field, value });
      return;
    }

    const globalMatch = key.match(
      /^VideoAnaly(?:se|ze)(?:Rule)?\.(?:Module\[(\d+)\]\.)?Rule\[(\d+)\]\.(.+)$/i,
    );
    if (!globalMatch) {
      return;
    }

    const moduleIndex = globalMatch[1] ? Number(globalMatch[1]) : 0;
    const ruleIndex = Number(globalMatch[2]);
    const field = String(globalMatch[3] || "").trim();
    if (
      !Number.isFinite(moduleIndex) ||
      !Number.isFinite(ruleIndex) ||
      !field
    ) {
      return;
    }

    indexSet.add(preferredIndex);
    rawRuleEntries.push({
      cfgIndex: preferredIndex,
      moduleIndex,
      ruleIndex,
      field,
      value,
    });
  });

  const availableIndexes = Array.from(indexSet).sort((a, b) => a - b);
  const selectedIndex = availableIndexes.includes(preferredIndex)
    ? preferredIndex
    : (availableIndexes[0] ?? preferredIndex);

  const ruleMap = {};
  rawRuleEntries.forEach((entry) => {
    if (entry.cfgIndex !== selectedIndex) {
      return;
    }

    const keyId = `${entry.moduleIndex}:${entry.ruleIndex}`;
    if (!ruleMap[keyId]) {
      ruleMap[keyId] = {
        index: entry.ruleIndex,
        moduleIndex: entry.moduleIndex,
      };
    }
    ruleMap[keyId][entry.field] = entry.value;
  });

  const rules = Object.values(ruleMap)
    .sort((a, b) => a.moduleIndex - b.moduleIndex || a.index - b.index)
    .map((rule) => {
      const derivedType = String(rule.Type || "").trim();
      const derivedName = String(rule.Name || rule.RuleName || "").trim();

      return {
        index: rule.index,
        moduleIndex: rule.moduleIndex,
        name: derivedName || `PeopleCounting${rule.index + 1}`,
        enabled: toBoolean(rule.Enable ?? "false"),
        type: derivedType || "PeopleCounting",
      };
    })
    .filter((rule) => !rule.type
      || isPeopleCountingRuleType(rule.type)
      || isPeopleCountingRuleType(rule.name));

  return {
    channelIndex: selectedIndex,
    rules,
  };
}

function parsePeopleCountingModulesFromMap(rawObj, preferredIndex = 0) {
  const modules = [];

  Object.entries(rawObj || {}).forEach(([key, value]) => {
    const match = key.match(/^VideoAnaly(?:se|ze)\[(\d+)\]\.Module\[(\d+)\]\.(Type|Name|Enable)$/i);
    if (!match) {
      return;
    }

    const cfgIndex = Number(match[1]);
    const moduleIndex = Number(match[2]);
    const field = String(match[3]);
    if (!Number.isFinite(cfgIndex) || cfgIndex !== preferredIndex || !Number.isFinite(moduleIndex)) {
      return;
    }

    if (!modules[moduleIndex]) {
      modules[moduleIndex] = {
        index: moduleIndex,
        name: "",
        type: "",
        enabled: false,
      };
    }

    if (field.toLowerCase() === "type") {
      modules[moduleIndex].type = String(value || "");
    }
    if (field.toLowerCase() === "name") {
      modules[moduleIndex].name = String(value || "");
    }
    if (field.toLowerCase() === "enable") {
      modules[moduleIndex].enabled = toBoolean(value);
    }
  });

  const cleanModules = modules.filter(Boolean);
  const moduleEnabled = cleanModules.some((module) => isPeopleCountingRuleType(module.type) && module.enabled)
    || cleanModules.some((module) => module.enabled && module.index === 0);

  return {
    modules: cleanModules,
    moduleEnabled,
  };
}

function parsePeopleCountingRulesFromVideoAnalyseRuleMap(rawObj, preferredIndex = 0) {
  const ruleMap = {};

  Object.entries(rawObj || {}).forEach(([key, value]) => {
    const indexed = key.match(/^VideoAnaly(?:se|ze)Rule\[(\d+)\]\[(\d+)\]\.(.+)$/i);
    if (indexed) {
      const cfgIndex = Number(indexed[1]);
      const ruleIndex = Number(indexed[2]);
      const field = String(indexed[3] || "").trim();
      if (!Number.isFinite(cfgIndex) || cfgIndex !== preferredIndex || !Number.isFinite(ruleIndex) || !field) {
        return;
      }

      if (!ruleMap[ruleIndex]) {
        ruleMap[ruleIndex] = { index: ruleIndex };
      }
      ruleMap[ruleIndex][field] = value;
      return;
    }

    const legacy = key.match(/^VideoAnaly(?:se|ze)\[(\d+)\]\.Rule\[(\d+)\]\.(.+)$/i);
    if (!legacy) {
      return;
    }

    const cfgIndex = Number(legacy[1]);
    const ruleIndex = Number(legacy[2]);
    const field = String(legacy[3] || "").trim();
    if (!Number.isFinite(cfgIndex) || cfgIndex !== preferredIndex || !Number.isFinite(ruleIndex) || !field) {
      return;
    }

    if (!ruleMap[ruleIndex]) {
      ruleMap[ruleIndex] = { index: ruleIndex };
    }
    ruleMap[ruleIndex][field] = value;
  });

  return Object.values(ruleMap)
    .sort((a, b) => a.index - b.index)
    .map((rule) => ({
      index: toInteger(rule.Id, rule.index),
      moduleIndex: 0,
      name: String(rule.Name || rule.RuleName || `Rule ${rule.index + 1}`),
      type: String(rule.Type || "NumberStat"),
      enabled: toBoolean(rule.Enable ?? false),
      raw: rule,
    }))
    .filter((rule) =>
      isPeopleCountingRuleType(rule.type) ||
      isPeopleCountingRuleType(rule.name),
    );
}

function parsePeopleCountingRulesFromVideoAnalyseGlobalSceneMap(rawObj, preferredIndex = 0) {
  const ruleMap = {};

  Object.entries(rawObj || {}).forEach(([key, value]) => {
    const keyIndexMatch = key.match(/^(?:table\.)?VideoAnalyseGlobal\[(\d+)\]\.Scene/i);
    if (!keyIndexMatch) {
      return;
    }

    const cfgIndex = Number(keyIndexMatch[1]);
    if (!Number.isFinite(cfgIndex) || cfgIndex !== preferredIndex) {
      return;
    }

    const typeListDirectMatch = key.match(/^(?:table\.)?VideoAnalyseGlobal\[(\d+)\]\.Scene\.TypeList\[(\d+)\]$/i);
    if (typeListDirectMatch) {
      const cfgIndex = Number(typeListDirectMatch[1]);
      const typeIndex = Number(typeListDirectMatch[2]);
      if (!Number.isFinite(cfgIndex) || cfgIndex !== preferredIndex || !Number.isFinite(typeIndex)) {
        return;
      }
      if (!isPeopleCountingRuleType(value)) {
        return;
      }

      if (!ruleMap[typeIndex]) {
        ruleMap[typeIndex] = { index: typeIndex };
      }
      ruleMap[typeIndex].Type = value;
      ruleMap[typeIndex].Name = "People Counting";
      ruleMap[typeIndex].Enable = true;
      return;
    }

    const typeListMatch = key.match(/^(?:table\.)?VideoAnalyseGlobal\[(\d+)\]\.Scene\.TypeList\[(\d+)\]\.(.+)$/i);
    if (typeListMatch) {
      const cfgIndex = Number(typeListMatch[1]);
      const typeIndex = Number(typeListMatch[2]);
      const field = String(typeListMatch[3] || "").trim();
      if (!Number.isFinite(cfgIndex) || cfgIndex !== preferredIndex || !Number.isFinite(typeIndex) || !field) {
        return;
      }

      if (!ruleMap[typeIndex]) {
        ruleMap[typeIndex] = { index: typeIndex };
      }
      ruleMap[typeIndex][field] = value;
      return;
    }

    const algTypeMatch = key.match(/^(?:table\.)?VideoAnalyseGlobal\[(\d+)\]\.Scene\.AlgType\[(\d+)\]\.(.+)$/i);
    if (algTypeMatch) {
      const cfgIndex = Number(algTypeMatch[1]);
      const algIndex = Number(algTypeMatch[2]);
      const field = String(algTypeMatch[3] || "").trim();
      if (!Number.isFinite(cfgIndex) || cfgIndex !== preferredIndex || !Number.isFinite(algIndex) || !field) {
        return;
      }

      if (!ruleMap[algIndex]) {
        ruleMap[algIndex] = { index: algIndex };
      }
      ruleMap[algIndex][field] = value;
    }
  });

  return Object.values(ruleMap)
    .sort((a, b) => a.index - b.index)
    .map((rule) => {
      const hasExplicitType = Object.prototype.hasOwnProperty.call(rule, "Type");
      const normalizedType = String(rule.Type || rule.SceneType || rule.AlgType || rule.Model || rule.Value || "").trim();
      const inferredType = normalizedType || (hasExplicitType ? "" : "NumberStat");
      const rawName = String(rule.Name || rule.RuleName || rule.Title || "").trim();

      return {
        index: toInteger(rule.Id, rule.index),
        moduleIndex: 0,
        name: rawName || (inferredType === "NumberStat" ? "People Counting" : `Scene ${rule.index + 1}`),
        type: inferredType,
        enabled: toBoolean(rule.Enable ?? rule.Model ?? false),
        raw: rule,
      };
    })
    .filter((rule) =>
      isPeopleCountingRuleType(rule.type) ||
      isPeopleCountingRuleType(rule.name),
    );
}

function extractVideoAnalyseGlobalSceneSummary(rawObj) {
  const sceneSummary = {};

  Object.entries(rawObj || {}).forEach(([key, value]) => {
    const match = key.match(/^(?:table\.)?VideoAnalyseGlobal\[(\d+)\]\.Scene\.TypeList\[(\d+)\](?:\.(.+))?$/i);
    if (!match) {
      return;
    }

    const channelIndex = Number(match[1]);
    const typeIndex = Number(match[2]);
    const field = String(match[3] || "value").trim();

    if (!sceneSummary[channelIndex]) {
      sceneSummary[channelIndex] = {};
    }
    if (!sceneSummary[channelIndex][typeIndex]) {
      sceneSummary[channelIndex][typeIndex] = {};
    }

    sceneSummary[channelIndex][typeIndex][field] = value;
  });

  return sceneSummary;
}

function inferVideoAnalyseGlobalEnableFromScene(rawObj, preferredIndex = 0) {
  const scenePrefix = `VideoAnalyseGlobal[${preferredIndex}].Scene.`;
  const sceneKeys = Object.keys(rawObj || {}).filter(
    (key) => key.startsWith(scenePrefix) || key.startsWith(`table.${scenePrefix}`),
  );

  const hasNumberStatType = sceneKeys.some((key) => /\.TypeList\[\d+\](?:\.Type)?$/i.test(key)
    && isPeopleCountingRuleType(rawObj[key]));
  const hasNumberStatEnabled = sceneKeys.some((key) => /\.TypeList\[\d+\]\.Enable$/i.test(key)
    && toBoolean(rawObj[key]));

  return {
    hasNumberStatType,
    hasNumberStatEnabled,
  };
}

function buildPeopleCountingConfigCandidates(preferredIndex = 0) {
  const idx = Math.max(Number(preferredIndex) || 0, 0);
  return Array.from(
    new Set([
      "VideoAnalyseGlobal",
      `VideoAnalyseGlobal[${idx}]`,
    ]),
  );
}

const peopleCountingSourceCache = new Map();

function buildMinimalPeopleCountingConfigCandidates(preferredIndex = 0) {
  const idx = Math.max(Number(preferredIndex) || 0, 0);
  const cached = peopleCountingSourceCache.get(idx);

 return [
        "NumberStat",
        `VideoAnalyse[${preferredIndex}]`
    ];
}

function buildConfigManagerQuery(params) {
  return Object.entries(params || {})
    .filter(
      ([, value]) => value !== undefined && value !== null && value !== "",
    )
    .map(([key, value]) => `${key}=${encodeURIComponent(String(value))}`)
    .join("&");
}

function parseAttachEventStream(rawData, expectedCodes = []) {
  const text = String(rawData || "");
  const rows = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const initialState = expectedCodes.reduce((accumulator, code) => {
    accumulator[code] = {
      active: false,
      action: "idle",
      raw: "",
    };
    return accumulator;
  }, {});

  rows.forEach((row) => {
    const codeMatch = row.match(/Code=([A-Za-z0-9_]+)/i);
    if (!codeMatch) {
      return;
    }

    const code = codeMatch[1];
    const action = (
      row.match(/action=([A-Za-z]+)/i)?.[1] || "start"
    ).toLowerCase();
    const isActive = !["stop", "end", "idle", "offline"].includes(action);

    initialState[code] = {
      active: isActive,
      action,
      raw: row,
    };
  });

  return initialState;
}

function buildAttachQuery({ channelId, eventCodes }) {
  const codesText = `[${(eventCodes || []).join(",")}]`;
  const encodedCodes = encodeURIComponent(codesText);

  return {
    raw: `action=attach&channel=${channelId}&codes=${codesText}`,
    encoded: `action=attach&channel=${channelId}&codes=${encodedCodes}`,
  };
}

export const cameraSettingsService = {
  getRealtimeEventStatus: async ({ channelId, eventCodes = [] }) => {
    const channelCandidates = [Number(channelId), Number(channelId) - 1].filter(
      (value, index, array) =>
        Number.isFinite(value) && value >= 0 && array.indexOf(value) === index,
    );

    const request = (queryString) =>
      ApiClient.get(`/cgi-bin/eventManager.cgi?${queryString}`, {
        timeout: 100000,
        responseType: "text",
        transformResponse: [(value) => value],
        headers: {
          "Cache-Control": "no-cache, no-store",
          Pragma: "no-cache",
        },
      });

    try {
      await warmupDigestChallenge();
      let lastError = null;

      for (const channelCandidate of channelCandidates) {
        const query = buildAttachQuery({
          channelId: channelCandidate,
          eventCodes,
        });
        const variants = [query.raw, query.encoded];

        for (const variant of variants) {
          try {
            const response = await request(variant);
            const raw = String(response?.data || "");
            return {
              events: parseAttachEventStream(raw, eventCodes),
              raw,
              fetchedAt: new Date().toISOString(),
            };
          } catch (error) {
            lastError = error;
          }
        }
      }

      throw lastError || new Error("Gagal attach ke eventManager.");
    } catch (firstError) {
      const status = Number(firstError?.response?.status || 0);
      if (status !== 401) {
        throw firstError;
      }

      await warmupDigestChallenge();
      let retryLastError = null;

      for (const channelCandidate of channelCandidates) {
        const query = buildAttachQuery({
          channelId: channelCandidate,
          eventCodes,
        });
        const variants = [query.raw, query.encoded];

        for (const variant of variants) {
          try {
            const retryResponse = await request(variant);
            const retryRaw = String(retryResponse?.data || "");
            return {
              events: parseAttachEventStream(retryRaw, eventCodes),
              raw: retryRaw,
              fetchedAt: new Date().toISOString(),
            };
          } catch (retryError) {
            retryLastError = retryError;
          }
        }
      }

      throw retryLastError || firstError;
    }
  },

  getPeopleCountingStats: async (channelId = 1) => {
    const cleanId = parseInt(String(channelId).replace(/\D/g, ""), 10) || 1;
    const path = `/cgi-bin/videoStatServer.cgi?action=getSummary&channel=${cleanId}&subType=NumberStat`;

    try {
      await warmupDigestChallenge();
      const response = await ApiClient.get(path);
      const authRetried =
        Number(response?.config?.__digestRetryCount || 0) > 0;
      logPeopleCountingEndpoint("getPeopleCountingStats response", {
        endpoint: path,
        channelId: cleanId,
        authRetried,
        data: response?.data,
      });
      const rawData = parseKeyValuePayload(response?.data);

      const entered = rawData.EnteredSubtotal || rawData["table.EnteredSubtotal"] || 0;
      const exited = rawData.ExitedSubtotal || rawData["table.ExitedSubtotal"] || 0;
      const inside = rawData.Inside || rawData["table.Inside"] || 0;
      const parsedStats = {
        entered: toInteger(entered, 0),
        exited: toInteger(exited, 0),
        inside: toInteger(inside, 0),
        authRetried,
      };

      logPeopleCountingEndpoint("getPeopleCountingStats parsed", {
        endpoint: path,
        channelId: cleanId,
        rawData,
        parsedStats,
      });

      return parsedStats;
    } catch (error) {
      const status = Number(error?.response?.status || 0);
      logPeopleCountingEndpointError("getPeopleCountingStats error", {
        endpoint: path,
        channelId: cleanId,
        status,
        message: error?.message,
        data: error?.response?.data,
      });
      return {
        entered: 0,
        exited: 0,
        inside: 0,
        unauthorized: status === 401,
        authRetried: false,
      };
    }
  },
  
  previewCameraEndpoint: async (endpoint) => {
    const response = await ApiClient.get(endpoint, {
      validateStatus: () => true,
      __skipDigestSign: true,
      __noRetry: true,
      headers: {
        "Cache-Control": "no-cache, no-store",
        Pragma: "no-cache",
      },
    });

    const preview = toEndpointPreview(response);
    logPeopleCountingEndpoint("previewCameraEndpoint response", {
      endpoint,
      status: preview.status,
      contentType: preview.contentType,
      data: preview.data,
    });

    return preview;
  },
  
  getPeopleCountingConfig: async (channelId = 1, options = {}) => {
    await warmupDigestChallenge();
    const cleanId = parseInt(String(channelId).replace(/\D/g, ""), 10) || 1;
    const preferredIndex = Math.max(cleanId - 1, 0);

    // Gunakan endpoint global saja untuk status enable utama.
    const candidateNames = options?.exhaustiveProbe
      ? Array.from(new Set([
          "VideoAnalyseRule",
          ...buildMinimalPeopleCountingConfigCandidates(preferredIndex),
          ...buildPeopleCountingConfigCandidates(preferredIndex),
        ]))
      : ["VideoAnalyseRule", "VideoAnalyseGlobal"];
    const diagnostics = [];
    let globalEnabled = false;
    let moduleEnabled = false;
    let rules = [];
    let sourceName = "";
    let authRetried = false;

    const isVideoAnalyseGlobalCandidate = (name) => /VideoAnaly(?:se|ze)Global/i.test(name);
    const isVideoAnalyseGlobalSceneCandidate = (name) => /VideoAnaly(?:se|ze)Global/i.test(name);

    for (const configName of candidateNames) {
      try {
        const endpoint = `/cgi-bin/configManager.cgi?action=getConfig&name=${encodeURIComponent(configName)}`;
        const response = await ApiClient.get(endpoint);
        authRetried =
          authRetried || Number(response?.config?.__digestRetryCount || 0) > 0;
        logPeopleCountingEndpoint("getPeopleCountingConfig response", {
          endpoint,
          channelId: cleanId,
          configName,
          authRetried,
          data: response?.data,
        });

        if (isErrorPayload(response?.data)) {
          diagnostics.push(`${configName}:error`);
          continue;
        }

        if (isVideoAnalyseGlobalConfigObject(response.data) && isVideoAnalyseGlobalCandidate(configName)) {
          const masterData = response.data.params.VideoAnalyseGlobal;
          const rawGlobalEnable = masterData?.Enable
            ?? masterData?.[preferredIndex]?.Enable
            ?? masterData?.[`[${preferredIndex}]`]?.Enable;

          const rawMaxModuleNum = masterData?.MaxModuleNum
            ?? masterData?.[preferredIndex]?.MaxModuleNum
            ?? masterData?.[`[${preferredIndex}]`]?.MaxModuleNum;

          globalEnabled = toBoolean(rawGlobalEnable);
          moduleEnabled = moduleEnabled || globalEnabled || toInteger(rawMaxModuleNum, 0) > 0;
          sourceName = sourceName || configName;
          diagnostics.push(`${configName}:json`);

          logPeopleCountingEndpoint("getPeopleCountingConfig global parsed", {
            endpoint,
            channelId: cleanId,
            configName,
            globalEnabled,
            moduleEnabled,
            rawGlobalEnable,
            rawMaxModuleNum,
            masterData,
          });
          continue;
        }

        if (isVideoAnalyseGlobalSceneConfigObject(response.data) && isVideoAnalyseGlobalSceneCandidate(configName)) {
          const rawObj = normalizeDahuaConfigMap(response.data);
          const sceneSummary = extractVideoAnalyseGlobalSceneSummary(rawObj);
          const sceneRules = parsePeopleCountingRulesFromVideoAnalyseGlobalSceneMap(rawObj, preferredIndex);
          const rawGlobal =
            rawObj[`VideoAnalyseGlobal[${preferredIndex}].Enable`]
            ?? rawObj["VideoAnalyseGlobal.Enable"];
          const rawMaxModuleNum =
            rawObj[`VideoAnalyseGlobal[${preferredIndex}].MaxModuleNum`]
            ?? rawObj["VideoAnalyseGlobal.MaxModuleNum"];

          const inferredEnable = inferVideoAnalyseGlobalEnableFromScene(rawObj, preferredIndex);

          globalEnabled = globalEnabled || toBoolean(rawGlobal) || inferredEnable.hasNumberStatType;
          moduleEnabled = moduleEnabled
            || globalEnabled
            || toInteger(rawMaxModuleNum, 0) > 0
            || inferredEnable.hasNumberStatEnabled;

          const scenePrefix = `VideoAnalyseGlobal[${preferredIndex}].Scene`;
          const scenePayload = Object.fromEntries(
            Object.entries(rawObj).filter(([key]) => key.startsWith(scenePrefix) || key.startsWith(`table.${scenePrefix}`))
          );

          logPeopleCountingEndpoint("getPeopleCountingConfig scene parsed", {
            endpoint,
            channelId: cleanId,
            configName,
            scenePrefix,
            globalEnabled,
            moduleEnabled,
            rawGlobal,
            rawMaxModuleNum,
            inferredEnable,
            sceneRuleCount: sceneRules.length,
            sceneRules,
            sceneSummary,
            scenePayload,
          });

          if (sceneRules.length > 0) {
            rules = sceneRules;
          }

          sourceName = sourceName || configName;
          diagnostics.push(`${configName}:json`);
          continue;
        }

        const rawObj = normalizeDahuaConfigMap(response.data);
        if (Object.keys(rawObj).length > 0) {
          const sceneSummary = extractVideoAnalyseGlobalSceneSummary(rawObj);
          const rawGlobal =
            rawObj[`VideoAnalyseGlobal[${preferredIndex}].Enable`]
            ?? rawObj["VideoAnalyseGlobal.Enable"];

          const rawMaxModuleNum =
            rawObj[`VideoAnalyseGlobal[${preferredIndex}].MaxModuleNum`]
            ?? rawObj["VideoAnalyseGlobal.MaxModuleNum"];

          const inferredEnable = inferVideoAnalyseGlobalEnableFromScene(rawObj, preferredIndex);

          const parsedModules = parsePeopleCountingModulesFromMap(rawObj, preferredIndex);
          const parsedRulesFromScene = parsePeopleCountingRulesFromVideoAnalyseGlobalSceneMap(rawObj, preferredIndex);
          const parsedRulesFromRule = parsePeopleCountingRulesFromVideoAnalyseRuleMap(rawObj, preferredIndex);
          const parsedRulesFromLegacy = parsePeopleCountingRulesFromMap(rawObj, preferredIndex).rules;

          const scenePrefix = `VideoAnalyseGlobal[${preferredIndex}].Scene`;
          const scenePayload = Object.fromEntries(
            Object.entries(rawObj).filter(([key]) => key.startsWith(scenePrefix) || key.startsWith(`table.${scenePrefix}`))
          );

          globalEnabled = globalEnabled || toBoolean(rawGlobal) || inferredEnable.hasNumberStatType;
          moduleEnabled = moduleEnabled
            || parsedModules.moduleEnabled
            || globalEnabled
            || toInteger(rawMaxModuleNum, 0) > 0
            || inferredEnable.hasNumberStatEnabled;
          if (rules.length === 0 && parsedRulesFromRule.length > 0) {
            rules = parsedRulesFromRule;
          }
          if (rules.length === 0 && parsedRulesFromScene.length > 0) {
            rules = parsedRulesFromScene;
          }
          if (rules.length === 0 && parsedRulesFromLegacy.length > 0) {
            rules = parsedRulesFromLegacy;
          }

          if (!sourceName) {
            sourceName = configName;
          }

          logPeopleCountingEndpoint("getPeopleCountingConfig fallback parsed", {
            endpoint,
            channelId: cleanId,
            configName,
            globalEnabled,
            moduleEnabled,
            rawGlobal,
            rawMaxModuleNum,
            inferredEnable,
            parsedModules,
            parsedRulesFromScene,
            parsedRulesFromRule,
            parsedRulesFromLegacy,
            sceneSummary,
            scenePayload,
          });

          diagnostics.push(`${configName}:kv`);
        }
      } catch (error) {
        diagnostics.push(`${configName}:fail(${error?.response?.status || "x"})`);
        logPeopleCountingEndpointError("getPeopleCountingConfig error", {
          endpoint: `/cgi-bin/configManager.cgi?action=getConfig&name=${encodeURIComponent(configName)}`,
          channelId: cleanId,
          configName,
          status: error?.response?.status,
          message: error?.message,
          data: error?.response?.data,
        });
      }
    }

    peopleCountingSourceCache.set(preferredIndex, sourceName || "VideoAnalyseGlobal");

    if (rules.length > 0 || globalEnabled || moduleEnabled) {
      return {
        channelIndex: preferredIndex,
        rules,
        globalEnabled: Boolean(globalEnabled),
        moduleEnabled: Boolean(moduleEnabled),
        sourceName: sourceName || "VideoAnalyseGlobal",
        diagnostics,
        authRetried,
        stats: {},
      };
    }

    return {
      channelIndex: preferredIndex,
      rules: [],
      globalEnabled: false,
      moduleEnabled: false,
      sourceName: "",
      stats: {},
      diagnostics,
      authRetried,
      notFound: true,
    };
  },

  setPeopleCountingEnable: async ({
    channelId,
    enabled,
    channelIndexOverride = null,
  }) => {
    const cleanId = parseInt(String(channelId).replace(/\D/g, ""), 10) || 1;
    const channelIndex =
      channelIndexOverride !== null
        ? channelIndexOverride
        : Math.max(cleanId - 1, 0);
    const nextValue = enabled ? "true" : "false";

    const params = {
      action: "setConfig",
      name: "VideoAnalyseGlobal",
      [`VideoAnalyseGlobal[${channelIndex}].Enable`]: nextValue,
    };

    const query = buildConfigManagerQuery(params);

    try {
      await warmupDigestChallenge();
      const response = await ApiClient.get(
        `/cgi-bin/configManager.cgi?${query}`,
      );
      logPeopleCountingEndpoint("setPeopleCountingEnable response", {
          endpoint: `/cgi-bin/configManager.cgi?${query}`,
          channelId: cleanId,
          channelIndex,
          enabled,
          data: response?.data,
        });
      return response?.data;
    } catch (error) {
      logPeopleCountingEndpointError("setPeopleCountingEnable error", {
        endpoint: `/cgi-bin/configManager.cgi?${query}`,
            channelId: cleanId,
            channelIndex,
            enabled,
            status: error?.response?.status,
            message: error?.message,
            data: error?.response?.data,
          });
      throw error;
    }
  },

  setPeopleCountingRuleEnable: async ({
    channelId,
    ruleIndex,
    enabled,
    channelIndexOverride = null,
  }) => {
    const cleanId = parseInt(String(channelId).replace(/\D/g, ""), 10) || 1;
    const channelIndex = Number.isFinite(Number(channelIndexOverride))
      ? Math.max(Number(channelIndexOverride), 0)
      : Math.max(cleanId - 1, 0);
    const safeRuleIndex = Number(ruleIndex);
    if (!Number.isFinite(safeRuleIndex) || safeRuleIndex < 0) {
      throw new Error("Rule index tidak valid.");
    }

    const nextValue = enabled ? "true" : "false";
      const query = buildConfigManagerQuery({
      action: "setConfig",
      name: "VideoAnalyseRule",
      [`VideoAnalyseRule[${channelIndex}][${safeRuleIndex}].Enable`]: nextValue,
    });

    try {
      await warmupDigestChallenge();
      const response = await ApiClient.get(`/cgi-bin/configManager.cgi?${query}`);
      logPeopleCountingEndpoint("setPeopleCountingRuleEnable response", {
        endpoint: `/cgi-bin/configManager.cgi?${query}`,
        channelId: cleanId,
        channelIndex,
        ruleIndex: safeRuleIndex,
        enabled,
        data: response?.data,
      });
      return response?.data;
    } catch (error) {
      logPeopleCountingEndpointError("setPeopleCountingRuleEnable error", {
        endpoint: `/cgi-bin/configManager.cgi?${query}`,
        channelId: cleanId,
        channelIndex,
        ruleIndex: safeRuleIndex,
        enabled,
        status: error?.response?.status,
        message: error?.message,
        data: error?.response?.data,
      });
      throw error;
    }
  },

  addPeopleCountingRule: async ({
    channelId,
    name,
    channelIndexOverride = null,
    existingRuleIndexes = [],
  }) => {
    const cleanId = parseInt(String(channelId).replace(/\D/g, ""), 10) || 1;
    const channelIndex = Number.isFinite(Number(channelIndexOverride))
      ? Math.max(Number(channelIndexOverride), 0)
      : Math.max(cleanId - 1, 0);
    const normalizedIndexes = Array.from(
      new Set(
        (Array.isArray(existingRuleIndexes) ? existingRuleIndexes : [])
          .map((value) => Number(value))
          .filter((value) => Number.isFinite(value) && value >= 0),
      ),
    );
    const nextRuleIndex =
      normalizedIndexes.length > 0 ? Math.max(...normalizedIndexes) + 1 : 0;
    const query = buildConfigManagerQuery({
      action: "setConfig",
      name: "VideoAnalyseRule",
      [`VideoAnalyseRule[${channelIndex}][${nextRuleIndex}].Type`]: "NumberStat",
      [`VideoAnalyseRule[${channelIndex}][${nextRuleIndex}].Enable`]: "true",
      [`VideoAnalyseRule[${channelIndex}][${nextRuleIndex}].Name`]:
        name || "PeopleCounter",
    });
    try {
      await warmupDigestChallenge();
      const response = await ApiClient.get(
        `/cgi-bin/configManager.cgi?${query}`,
      );
        logPeopleCountingEndpoint("addPeopleCountingRule response", {
          endpoint: `/cgi-bin/configManager.cgi?${query}`,
          channelId: cleanId,
          channelIndex,
          ruleIndex: nextRuleIndex,
          name: name || "PeopleCounter",
          data: response?.data,
        });
      return response?.data;
    } catch (error) {
      logPeopleCountingEndpointError("addPeopleCountingRule error", {
          endpoint: `/cgi-bin/configManager.cgi?${query}`,
          channelId: cleanId,
          channelIndex,
          ruleIndex: nextRuleIndex,
          name: name || "PeopleCounter",
          status: error?.response?.status,
          message: error?.message,
          data: error?.response?.data,
        });
      throw error;
    }
  },

  deletePeopleCountingRule: async ({
    channelId,
    ruleIndex,
    channelIndexOverride = null,
  }) => {
    const cleanId = parseInt(String(channelId).replace(/\D/g, ""), 10) || 1;
    const channelIndex = Number.isFinite(Number(channelIndexOverride))
      ? Math.max(Number(channelIndexOverride), 0)
      : Math.max(cleanId - 1, 0);
    const safeRuleIndex = Number(ruleIndex);
    if (!Number.isFinite(safeRuleIndex) || safeRuleIndex < 0) {
      throw new Error("Rule index tidak valid.");
    }

    const query = buildConfigManagerQuery({
      action: "setConfig",
      name: "VideoAnalyseRule",
      [`VideoAnalyseRule[${channelIndex}][${safeRuleIndex}].Enable`]: "false",
      [`VideoAnalyseRule[${channelIndex}][${safeRuleIndex}].Type`]: "",
      [`VideoAnalyseRule[${channelIndex}][${safeRuleIndex}].Name`]: "",
    });

    try {
      await warmupDigestChallenge();
      const response = await ApiClient.get(`/cgi-bin/configManager.cgi?${query}`);
      logPeopleCountingEndpoint("deletePeopleCountingRule response", {
        endpoint: `/cgi-bin/configManager.cgi?${query}`,
        channelId: cleanId,
        channelIndex,
        ruleIndex: safeRuleIndex,
        data: response?.data,
      });
      return response?.data;
    } catch (error) {
      logPeopleCountingEndpointError("deletePeopleCountingRule error", {
        endpoint: `/cgi-bin/configManager.cgi?${query}`,
        channelId: cleanId,
        channelIndex,
        ruleIndex: safeRuleIndex,
        status: error?.response?.status,
        message: error?.message,
        data: error?.response?.data,
      });
      throw error;
    }
  },
};
