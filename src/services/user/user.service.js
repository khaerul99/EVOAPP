import ApiClient from "../../lib/api";
import { authStore } from "../../stores/authSlice";
import { loginWithDigest } from "../auth/auth.service";
import {
  buildDigestAuthorizationHeader,
  formatNc,
  createCnonce,
} from "../../lib/auth-helper";
import { getRequestUri } from "../../lib/api-config";

function toTextPayload(rawData) {
  if (typeof rawData === "string") {
    return rawData;
  }

  if (rawData === null || rawData === undefined) {
    return "";
  }

  if (typeof rawData === "object") {
    try {
      return JSON.stringify(rawData);
    } catch {
      return String(rawData);
    }
  }

  return String(rawData);
}

function parseKeyValuePayload(rawData) {
  if (rawData && typeof rawData === "object" && !Array.isArray(rawData)) {
    const objectOutput = {};

    Object.entries(rawData).forEach(([key, value]) => {
      if (!key) {
        return;
      }

      if (value === undefined || value === null) {
        objectOutput[String(key).trim()] = "";
        return;
      }

      if (typeof value === "object") {
        objectOutput[String(key).trim()] = JSON.stringify(value);
        return;
      }

      objectOutput[String(key).trim()] = String(value).trim();
    });

    return objectOutput;
  }

  const payload = toTextPayload(rawData);
  const output = {};

  payload
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .forEach((line) => {
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

function pickFirstValue(source, candidates) {
  for (const key of candidates) {
    const value = source?.[key];
    if (value === undefined || value === null) {
      continue;
    }

    const text = String(value).trim();
    if (text) {
      return text;
    }
  }

  return "";
}

function normalizeUserRecord(user, index = 0) {
  const name = pickFirstValue(user, [
    "Name",
    "name",
    "UserName",
    "username",
    "User",
    "user",
  ]);
  const group = pickFirstValue(user, [
    "GroupName",
    "Group",
    "group",
    "UserGroup",
  ]);
  const remark = pickFirstValue(user, [
    "Memo",
    "memo",
    "Remark",
    "remark",
    "Comment",
  ]);
  const authority = pickFirstValue(user, [
    "Authority",
    "authority",
    "Level",
    "level",
    "Type",
    "type",
  ]);
  const authorities = Array.isArray(user?.AuthorityList)
    ? user.AuthorityList.map((entry) => String(entry || "").trim()).filter(
        Boolean,
      )
    : [];

  return {
    id: index + 1,
    name: name || "-",
    group: group || "-",
    authority: authority || "-",
    remark,
    authorities,
    raw: user,
  };
}

function parseUsersFromObjectPayload(rawData) {
  if (Array.isArray(rawData)) {
    return rawData.map((entry, index) =>
      normalizeUserRecord(entry || {}, index),
    );
  }

  if (!rawData || typeof rawData !== "object") {
    return [];
  }

  const objectValues = Object.values(rawData);
  const hasObjectArray = objectValues.every(
    (value) => value && typeof value === "object",
  );
  if (hasObjectArray && objectValues.length > 0) {
    return objectValues.map((entry, index) =>
      normalizeUserRecord(entry || {}, index),
    );
  }

  return [normalizeUserRecord(rawData, 0)];
}

function normalizeGroupRecord(group, index = 0) {
  const name = pickFirstValue(group, [
    "Name",
    "name",
    "GroupName",
    "groupName",
    "Group",
    "group",
  ]);
  const memo = pickFirstValue(group, [
    "Memo",
    "memo",
    "Remark",
    "remark",
    "Comment",
  ]);
  const id = pickFirstValue(group, ["Id", "id", "Index", "index"]);

  return {
    id: id ? String(id) : String(index + 1),
    groupName: name || "-",
    memo,
    raw: group,
  };
}

function parseGroupsFromObjectPayload(rawData) {
  if (Array.isArray(rawData)) {
    return rawData.map((entry, index) =>
      normalizeGroupRecord(entry || {}, index),
    );
  }

  if (!rawData || typeof rawData !== "object") {
    return [];
  }

  // Direct object keyed by id/index -> values are objects
  const objectValues = Object.values(rawData);
  const hasObjectArray =
    objectValues.length > 0 &&
    objectValues.every(
      (value) => value && typeof value === "object" && !Array.isArray(value),
    );
  if (hasObjectArray) {
    return objectValues.map((entry, index) =>
      normalizeGroupRecord(entry || {}, index),
    );
  }

  // Single object record
  const singleName = pickFirstValue(rawData, [
    "Name",
    "name",
    "GroupName",
    "groupName",
    "Group",
    "group",
  ]);
  if (singleName) {
    return [normalizeGroupRecord(rawData, 0)];
  }

  return [];
}

function parseGroupsFromKeyValuePayload(rawData) {
  const keyValueMap = parseKeyValuePayload(rawData);
  const groupedGroups = {};

  const patterns = [
    /^(?:table\.)?(?:group|groups)\[(\d+)\]\.(.+)$/i,
    /^(?:table\.)?(?:group|groups)\.([^.]+)\.(.+)$/i,
  ];

  Object.entries(keyValueMap).forEach(([key, value]) => {
    for (const pattern of patterns) {
      const match = key.match(pattern);
      if (!match) {
        continue;
      }

      const groupId = String(match[1] || "").trim();
      const field = String(match[2] || "").trim();
      if (!groupId || !field) {
        return;
      }

      if (!groupedGroups[groupId]) {
        groupedGroups[groupId] = {};
      }

      groupedGroups[groupId][field] = value;
      return;
    }
  });

  const groups = Object.keys(groupedGroups)
    .sort((a, b) => Number(a) - Number(b))
    .map((groupId) => {
      const raw = groupedGroups[groupId] || {};
      const normalized = { ...raw };

      Object.keys(raw).forEach((field) => {
        const normalizedField = field.includes(".")
          ? field.split(".").pop()
          : field;
        normalized[normalizedField] = raw[field];
      });

      return normalized;
    });

  if (groups.length > 0) {
    return groups.map((entry, index) => normalizeGroupRecord(entry, index));
  }

  return [];
}

function parseGroupList(rawData) {
  // Try key-value parser first (covers raw string and plain object key maps like {"group[0].Name": "admin"})
  const keyValueGroups = parseGroupsFromKeyValuePayload(rawData);
  if (keyValueGroups.length > 0) {
    return keyValueGroups;
  }

  // Fallback for proper object/array payloads
  return parseGroupsFromObjectPayload(rawData);
}

function parseUsersFromKeyValuePayload(rawData) {
  const keyValueMap = parseKeyValuePayload(rawData);
  const groupedUsers = {};

  const patterns = [
    /^(?:table\.)?(?:userInfo|users?|user)\[(\d+)\]\.(.+)$/i,
    /^(?:table\.)?(?:userInfo|users?|user)\.([^.]+)\.(.+)$/i,
  ];

  Object.entries(keyValueMap).forEach(([key, value]) => {
    let matched = false;

    const authorityMatch =
      key.match(
        /^(?:table\.)?(?:userInfo|users?|user)\[(\d+)\]\.AuthorityList\[(\d+)\]$/i,
      ) ||
      key.match(
        /^(?:table\.)?(?:userInfo|users?|user)\.([^.]+)\.AuthorityList\[(\d+)\]$/i,
      );
    if (authorityMatch) {
      const userId = String(authorityMatch[1] || "").trim();
      const index = String(authorityMatch[2] || "").trim();
      if (userId) {
        if (!groupedUsers[userId]) {
          groupedUsers[userId] = {};
        }
        if (!Array.isArray(groupedUsers[userId].AuthorityList)) {
          groupedUsers[userId].AuthorityList = [];
        }
        groupedUsers[userId].AuthorityList[Number(index)] = value;
        return;
      }
    }

    for (const pattern of patterns) {
      const match = key.match(pattern);
      if (!match) {
        continue;
      }

      const userId = String(match[1] || "").trim();
      const field = String(match[2] || "").trim();
      if (!userId || !field) {
        return;
      }

      if (!groupedUsers[userId]) {
        groupedUsers[userId] = {};
      }

      groupedUsers[userId][field] = value;
      matched = true;
      break;
    }

    if (matched) {
      return;
    }

    if (/\bname$/i.test(key)) {
      if (!groupedUsers.single) {
        groupedUsers.single = {};
      }
      groupedUsers.single[key] = value;
    }
  });

  const users = Object.keys(groupedUsers).map((userId) => {
    const raw = groupedUsers[userId] || {};
    const normalized = { ...raw };

    Object.keys(raw).forEach((field) => {
      const normalizedField = field.includes(".")
        ? field.split(".").pop()
        : field;
      normalized[normalizedField] = raw[field];
    });

    if (Array.isArray(raw.AuthorityList)) {
      normalized.AuthorityList = raw.AuthorityList.filter(Boolean);
    }

    return normalized;
  });

  if (users.length > 0) {
    return users.map((entry, index) => normalizeUserRecord(entry, index));
  }

  return [];
}

function parseUserList(rawData) {
  if (rawData && typeof rawData === "object") {
    return parseUsersFromObjectPayload(rawData);
  }

  const users = parseUsersFromKeyValuePayload(rawData);
  if (users.length > 0) {
    return users;
  }

  return [];
}

function parseQueryStringInput(queryString) {
  const params = {};
  const raw = String(queryString || "").trim();
  if (!raw) {
    return params;
  }

  raw
    .replace(/^\?/, "")
    .split("&")
    .map((part) => part.trim())
    .filter(Boolean)
    .forEach((part) => {
      const [key, ...rest] = part.split("=");
      const normalizedKey = decodeURIComponent(String(key || "").trim());
      if (!normalizedKey) {
        return;
      }

      const joinedValue = rest.join("=");
      params[normalizedKey] = decodeURIComponent(
        String(joinedValue || "").trim(),
      );
    });

  return params;
}

function normalizeAuthorityList(authorityInput) {
  if (Array.isArray(authorityInput)) {
    return authorityInput
      .map((entry) => String(entry || "").trim())
      .filter(Boolean);
  }

  return String(authorityInput || "")
    .split(",")
    .map((entry) => String(entry || "").trim())
    .filter(Boolean);
}

function toLegacyAuthorityToken(token) {
  const raw = String(token || "").trim();
  const liveMatch = raw.match(/^LiveChannel(\d+)$/i);
  if (liveMatch) {
    return `Monitor_${String(Number(liveMatch[1])).padStart(2, '0')}`;
  }

  const playbackMatch = raw.match(/^PlaybackChannel(\d+)$/i);
  if (playbackMatch) {
    return `Replay_${String(Number(playbackMatch[1])).padStart(2, '0')}`;
  }

  return raw;
}

function normalizeGroupAuthorityList(authorityInput) {
  return normalizeAuthorityList(authorityInput).map(toLegacyAuthorityToken);
}

function buildGroupInfoPayload(payload = {}) {
  const name = String(payload?.name || "").trim();
  const memo = String(payload?.memo || "").trim();
  const authorityList = normalizeGroupAuthorityList(payload?.authorities ?? payload?.authority);

  const group = {
    Name: name,
  };

  if (memo) {
    group.Memo = memo;
  }

  if (authorityList.length > 0) {
    group.AuthorityList = authorityList;
  }

  return group;
}

function isBadRequestError(error) {
  const status = error?.response?.status;
  const body = String(error?.response?.data || "").toLowerCase();
  return status === 400 || body.includes("bad request");
}

function isAuthError(error) {
  const status = error?.response?.status;
  return status === 401 || status === 403;
}

function isFailedActionPayload(data) {
  if (data === null || data === undefined) {
    return false;
  }

  const text = String(data).trim().toLowerCase();
  if (!text) {
    return false;
  }

  const hasFailureSignal =
    text.includes("error") ||
    text.includes("failed") ||
    text.includes("bad request") ||
    text.includes("invalid") ||
    text.includes("denied");
  const hasSuccessSignal = text.includes("ok") || text.includes("success");

  return hasFailureSignal && !hasSuccessSignal;
}

async function callUserManagerWithParamFallback(paramVariants = []) {
  let lastError;

  for (const params of paramVariants) {
    try {
      const response = await ApiClient.get("/cgi-bin/userManager.cgi", {
        params,
      });

      if (isFailedActionPayload(response?.data)) {
        const actionError = new Error(
          String(response?.data || "User manager action failed."),
        );
        actionError.response = {
          data: response?.data,
          status: response?.status,
        };
        throw actionError;
      }

      return response?.data;
    } catch (error) {
      if (isAuthError(error)) {
        throw error;
      }

      lastError = error;
    }
  }

  if (lastError) {
    throw lastError;
  }

  throw new Error(
    "Tidak ada format parameter yang bisa dipakai untuk request userManager.",
  );
}

function buildAddUserParams(
  payload = {},
  extraQuery = "",
  mode = "nested",
  options = {},
) {
  const action = String(options?.action || "addUser").trim() || "addUser";
  const profile = String(options?.profile || "full").trim();
  const authorityMode = String(options?.authorityMode || "default").trim();
  const name = String(payload?.name || "").trim();
  const password = String(payload?.password || "").trim();
  const group = String(payload?.group || "").trim();
  const memo = String(payload?.remark || "").trim();
  const sharable =
    payload?.sharable !== undefined
      ? String(Boolean(payload.sharable))
      : "true";
  const reserved =
    payload?.reserved !== undefined
      ? String(Boolean(payload.reserved))
      : "false";
  const needModPwd =
    payload?.needModPwd !== undefined
      ? String(Boolean(payload.needModPwd))
      : "false";
  const authorityList = normalizeAuthorityList(payload?.authority);

  const params =
    mode === "flat"
      ? {
          action,
          name,
          pwd: password,
          Name: name,
          Password: password,
        }
      : {
          action,
          "user.Name": name,
          "user.Password": password,
        };

  if (profile === "full") {
    if (mode === "flat") {
      params.sharable = sharable;
      params.reserved = reserved;
      params.needModPwd = needModPwd;
    } else {
      params["user.Sharable"] = sharable;
      params["user.Reserved"] = reserved;
      params["user.NeedModPwd"] = needModPwd;
    }
  }

  if (group) {
    params[mode === "flat" ? "group" : "user.Group"] = group;
    if (mode === "flat" && profile === "minimal") {
      params.Group = group;
    }
  }

  if (memo) {
    params[mode === "flat" ? "memo" : "user.Memo"] = memo;
  }

  if (authorityList.length > 0) {
    authorityList.forEach((entry, index) => {
      let authorityKey;
      if (mode === "flat") {
        authorityKey =
          authorityMode === "AuthorityList"
            ? `AuthorityList[${index}]`
            : `authorities[${index}]`;
      } else {
        authorityKey = `user.AuthorityList[${index}]`;
      }
      params[authorityKey] = entry;
    });

    if (mode === "flat") {
      params.authority = authorityList.join(",");
    }
  }

  return {
    ...params,
    ...parseQueryStringInput(extraQuery),
  };
}

function buildModifyUserParams(
  payload = {},
  extraQuery = "",
  fallbackAuthorities = [],
  mode = "nested",
  options = {},
) {
  const action = String(options?.action || "modifyUser").trim() || "modifyUser";
  const profile = String(options?.profile || "full").trim();
  const authorityMode = String(options?.authorityMode || "default").trim();
  const name = String(payload?.name || "").trim();
  const password = String(payload?.password || "").trim();
  const group = String(payload?.group || "").trim();
  const memo = String(payload?.remark || "").trim();
  const sharable =
    payload?.sharable !== undefined
      ? String(Boolean(payload.sharable))
      : "true";
  const reserved =
    payload?.reserved !== undefined
      ? String(Boolean(payload.reserved))
      : "false";
  const authorities = normalizeAuthorityList(payload?.authority);
  const mergedAuthorities =
    authorities.length > 0
      ? authorities
      : normalizeAuthorityList(fallbackAuthorities);

  const params =
    mode === "flat"
      ? {
          action,
          name,
          oldName: name,
          Name: name,
        }
      : {
          action,
          name,
        };

  if (profile === "full") {
    if (mode === "flat") {
      params.sharable = sharable;
      params.reserved = reserved;
    } else {
      params["user.Sharable"] = sharable;
      params["user.Reserved"] = reserved;
    }
  }

  if (name) {
    if (mode !== "flat") {
      params["user.Name"] = name;
    } else {
      params.userName = name;
    }
  }

  if (password) {
    params[mode === "flat" ? "pwd" : "user.Password"] = password;
    if (mode === "flat") {
      params.Password = password;
    }
  }

  if (group) {
    params[mode === "flat" ? "group" : "user.Group"] = group;
    if (mode === "flat" && profile === "minimal") {
      params.Group = group;
    }
  }

  if (memo) {
    params[mode === "flat" ? "memo" : "user.Memo"] = memo;
  }

  if (mergedAuthorities.length > 0) {
    mergedAuthorities.forEach((entry, index) => {
      let authorityKey;
      if (mode === "flat") {
        authorityKey =
          authorityMode === "AuthorityList"
            ? `AuthorityList[${index}]`
            : `authorities[${index}]`;
      } else {
        authorityKey = `user.AuthorityList[${index}]`;
      }
      params[authorityKey] = entry;
    });

    if (mode === "flat") {
      params.authority = mergedAuthorities.join(",");
    }
  }

  return {
    ...params,
    ...parseQueryStringInput(extraQuery),
  };
}

export const userService = {
  getAllUsers: async () => {
    const response = await ApiClient.get("/cgi-bin/userManager.cgi", {
      params: { action: "getUserInfoAll" },
    });

    return {
      users: parseUserList(response?.data),
      raw: response?.data,
    };
  },

  getAllGroups: async () => {
    const response = await ApiClient.get("/cgi-bin/userManager.cgi", {
      params: { action: "getGroupInfoAll" },
    });

    return {
      groups: parseGroupList(response?.data),
      raw: response?.data,
    };
  },

  addGroup: async ({ payload = {}, authPassword = "" }) => {
    const groupInfo = buildGroupInfoPayload(payload);
    const apiRequestBody = { group: groupInfo };

    console.log("[userService] addGroup request (API):", {
      endpoint: "/cgi-bin/api/userManager/addGroup",
      requestBody: apiRequestBody,
    });

    // Ensure auth session is active with provided credentials
    if (authPassword) {
      const state = authStore.getState();
      const currentUsername = state?.auth?.username;
      if (currentUsername && authPassword) {
        try {
          await loginWithDigest(currentUsername, authPassword);
          console.log("[userService] addGroup: digest auth session refreshed with new password");
        } catch (err) {
          console.warn("[userService] addGroup: digest auth refresh failed:", err?.message);
        }
      }
    }

    try {
      const response = await ApiClient.post(
        "/cgi-bin/api/userManager/addGroup",
        apiRequestBody,
      );
      console.log("[userService] addGroup response (API):", response?.data);
      return response?.data;
    } catch (error) {
      const status = error?.response?.status;
      const errorMessage = error?.response?.data || error?.message || String(error);
      console.error("[userService] addGroup API error:", {
        status,
        errorData: errorMessage,
        error,
      });

      // Fallback ke CGI untuk status: 400, 404, 405, 501
      const canFallback = status === 400 || status === 404 || status === 405 || status === 501;
      if (!canFallback) {
        throw error;
      }

      const fallbackParams = {
        action: "addGroup",
        "group.Name": groupInfo.Name,
      };
      if (groupInfo.Memo) {
        fallbackParams["group.Memo"] = groupInfo.Memo;
      }
      if (Array.isArray(groupInfo.AuthorityList)) {
        groupInfo.AuthorityList.forEach((entry, index) => {
          fallbackParams[`group.AuthorityList[${index}]`] = entry;
        });
      }

      console.warn("[userService] addGroup API error (status: " + status + "), falling back to CGI:", {
        endpoint: "/cgi-bin/userManager.cgi",
        params: fallbackParams,
      });

      const fallbackResponse = await ApiClient.get(
        "/cgi-bin/userManager.cgi",
        { params: fallbackParams },
      );
      console.log("[userService] addGroup response (CGI):", fallbackResponse?.data);
      return fallbackResponse?.data;
    }
  },

  deleteGroup: async ({ name, authPassword = "" }) => {
    const groupName = String(name || "").trim();
    if (!groupName) {
      throw new Error("Nama group wajib diisi.");
    }

    const requestBody = {
      name: groupName,
    };

    const state = authStore.getState();
    const managerName = String(state?.auth?.username || "").trim();
    const password = String(authPassword || "").trim();

    if (managerName) {
      requestBody.managerName = managerName;
    }
    if (password) {
      requestBody.password = password;
      requestBody.managerPwd = password;
    }

    const response = await ApiClient.post(
      "/cgi-bin/api/userManager/deleteGroup",
      requestBody,
    );
    return response?.data;
  },

  modifyGroup: async ({ payload = {}, authPassword = "" }) => {
    const groupName = String(payload?.name || "").trim();
    const nextGroupName = String(
      payload?.nextName || payload?.name || "",
    ).trim();
    if (!groupName || !nextGroupName) {
      throw new Error("Nama group wajib diisi.");
    }

    const memo = String(payload?.memo || "").trim();
    const authorityList = Array.isArray(payload?.authorities)
      ? payload.authorities
          .map((entry) => String(entry || "").trim())
          .filter(Boolean)
      : String(payload?.authority || "")
          .split(",")
          .map((entry) => String(entry || "").trim())
          .filter(Boolean);

    const requestBody = {
      name: groupName,
      group: {
        Name: nextGroupName,
      },
    };

    if (memo) {
      requestBody.group.Memo = memo;
    }

    if (authorityList.length > 0) {
      requestBody.group.AuthorityList = authorityList;
    }

    // Auth handled via digest header, not in request body
    console.log("[userService] modifyGroup request:", {
      endpoint: "/cgi-bin/api/userManager/modifyGroup",
      requestBody,
    });

    const response = await ApiClient.post(
      "/cgi-bin/api/userManager/modifyGroup",
      requestBody,
    );

    console.log("[userService] modifyGroup response:", response?.data);

    return response?.data;
  },

  getUserByName: async (name) => {
    const response = await ApiClient.get("/cgi-bin/userManager.cgi", {
      params: {
        action: "getUserInfo",
        name,
      },
    });

    const parsedUsers = parseUserList(response?.data);
    return {
      user: parsedUsers[0] || null,
      raw: response?.data,
    };
  },

  addUser: async ({ payload = {}, extraQuery = "" }) => {
    return callUserManagerWithParamFallback([
      buildAddUserParams(payload, extraQuery, "nested", { profile: "full" }),
      buildAddUserParams(payload, extraQuery, "flat", {
        profile: "full",
        authorityMode: "default",
      }),
    ]);
  },

  modifyUser: async ({ payload = {}, extraQuery = "" }) => {
    try {
      return await callUserManagerWithParamFallback([
        buildModifyUserParams(payload, extraQuery, [], "nested", {
          profile: "minimal",
        }),
        buildModifyUserParams(payload, extraQuery, [], "flat", {
          profile: "minimal",
          authorityMode: "default",
        }),
      ]);
    } catch (error) {
      if (!isBadRequestError(error)) {
        throw error;
      }

      const currentUser = await userService.getUserByName(payload?.name);
      const fallbackAuthorities =
        currentUser?.user?.authorities ||
        currentUser?.user?.raw?.AuthorityList ||
        [];
      return callUserManagerWithParamFallback([
        buildModifyUserParams(
          payload,
          extraQuery,
          fallbackAuthorities,
          "nested",
          { profile: "full" },
        ),
        buildModifyUserParams(
          payload,
          extraQuery,
          fallbackAuthorities,
          "flat",
          { profile: "full", authorityMode: "default" },
        ),
      ]);
    }
  },

  deleteUser: async ({ name, extraQuery = "", authPassword = "" }) => {
    const state = authStore.getState();
    const managerName = String(state?.auth?.username || "").trim();
    const password = String(authPassword || "").trim();
    const baseParams = {
      action: "deleteUser",
      name,
      ...parseQueryStringInput(extraQuery),
    };

    // Follow documentation first: only action + name.
    const variants = [
      baseParams,
      {
        ...baseParams,
        ...(managerName ? { managerName } : {}),
        ...(password ? { password, managerPwd: password } : {}),
      },
    ];

    let lastError;
    for (let i = 0; i < variants.length; i += 1) {
      try {
        const response = await ApiClient.get("/cgi-bin/userManager.cgi", {
          params: variants[i],
        });
        return response?.data;
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError || new Error("Gagal menghapus user.");
  },

  modifyPassword: async ({ name, pwd, pwdOld, extraQuery = "" }) => {
    const normalizedName = String(name || "").trim();
    const normalizedOldPassword = String(pwdOld || "").trim();
    if (!normalizedName) {
      throw new Error("Nama user wajib diisi.");
    }

    if (!normalizedOldPassword) {
      throw new Error("Old password wajib diisi.");
    }

    try {
      await loginWithDigest(normalizedName, normalizedOldPassword);
    } catch {
      throw new Error("Old password salah.");
    }

    const response = await ApiClient.get("/cgi-bin/userManager.cgi", {
      params: {
        action: "modifyPassword",
        name: normalizedName,
        pwd,
        pwdOld: normalizedOldPassword,
        ...parseQueryStringInput(extraQuery),
      },
    });

    return response?.data;
  },
};
