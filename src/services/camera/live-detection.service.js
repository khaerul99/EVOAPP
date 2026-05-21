import ApiClient from '../../lib/api';
import { warmupDigestChallenge } from '../auth/digest-warmup.service';

const DETECTION_EVENT_CODES = Object.freeze([
    'HumanTrait',
    'SmartMotionHuman',
    'SmartMotionVehicle',
]);
const DETECTION_EVENT_CODES_LOWER = new Set(DETECTION_EVENT_CODES.map((value) => value.toLowerCase()));
const SUPPORTED_CODES_REGEX = /(HumanTrait|SmartMotionHuman|SmartMotionVehicle)/i;

function normalizeBoundingBox(rawBox) {
    if (!Array.isArray(rawBox) || rawBox.length < 4) {
        return null;
    }
    const values = rawBox.slice(0, 4).map((value) => Number.parseInt(String(value ?? ''), 10));
    if (!values.every((value) => Number.isFinite(value))) {
        return null;
    }
    const [x1, y1, x2, y2] = values;
    const left = Math.max(0, Math.min(x1, x2));
    const top = Math.max(0, Math.min(y1, y2));
    const right = Math.max(left + 1, Math.max(x1, x2));
    const bottom = Math.max(top + 1, Math.max(y1, y2));
    return [left, top, right, bottom];
}

function toDetectionLabel(code) {
    const normalized = String(code || '').toLowerCase();
    if (normalized === 'humantrait') return 'Human Detection';
    if (normalized === 'smartmotionhuman') return 'Human Detection (SMD)';
    if (normalized === 'smartmotionvehicle') return 'Motor Vehicle Detection';
    return String(code || 'Detection');
}

function parseAttachEntriesFromRaw(rawText) {
    const text = String(rawText || '');
    if (!text) return [];

    const out = [];
    let cursor = 0;
    while (cursor < text.length) {
        const marker = /Code=([A-Za-z0-9_]+);action=([A-Za-z]+);index=(-?\d+);data=/gi;
        marker.lastIndex = cursor;
        const match = marker.exec(text);
        if (!match) break;

        const code = String(match[1] || '');
        const action = String(match[2] || 'start').toLowerCase();
        const index = Number.parseInt(String(match[3] || ''), 10);
        const jsonStart = text.indexOf('{', marker.lastIndex - 1);
        if (jsonStart < 0) {
            cursor = marker.lastIndex;
            continue;
        }

        let depth = 0;
        let jsonEnd = -1;
        for (let i = jsonStart; i < text.length; i += 1) {
            const ch = text[i];
            if (ch === '{') depth += 1;
            if (ch === '}') {
                depth -= 1;
                if (depth === 0) {
                    jsonEnd = i;
                    break;
                }
            }
        }
        if (jsonEnd < 0) break;

        try {
            const data = JSON.parse(text.slice(jsonStart, jsonEnd + 1));
            out.push({
                code,
                action,
                active: !['stop', 'end', 'idle', 'offline'].includes(action),
                fields: Number.isFinite(index) ? { index } : {},
                data,
                raw: text.slice(match.index, jsonEnd + 1),
            });
        } catch {
            // ignore malformed chunk
        }
        cursor = jsonEnd + 1;
    }
    return out;
}

function extractHumanImage(data = {}) {
    const human = data?.HumanAttributes || {};
    const imageData = human?.HumanImage || data?.HumanImage;
    if (!imageData) return null;
    const base64Str = String(imageData || '').trim();
    if (!base64Str || base64Str.length < 10) return null;
    try {
        const byteCharacters = atob(base64Str);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i += 1) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        return new Blob([byteArray], { type: 'image/jpeg' });
    } catch {
        return null;
    }
}

function parseHumanTraits(human = {}, fields = {}) {
    const coatType = Number.parseInt(String(human?.CoatType ?? fields['Data.HumanAttributes.CoatType'] ?? ''), 10);
    const trousersType = Number.parseInt(String(human?.TrousersType ?? fields['Data.HumanAttributes.TrousersType'] ?? ''), 10);
    const hasHat = Number.parseInt(String(human?.HasHat ?? fields['Data.HumanAttributes.HasHat'] ?? ''), 10);
    const hasBag = Number.parseInt(String(human?.HasBag ?? fields['Data.HumanAttributes.HasBag'] ?? ''), 10);
    return {
        coatColor: human?.CoatColor || fields['Data.HumanAttributes.CoatColor'] || 'Unknown',
        sleeves: coatType === 1 ? 'Long Sleeves' : (coatType === 2 ? 'Short Sleeves' : 'Unknown Sleeves'),
        lowerColor: human?.TrousersColor || fields['Data.HumanAttributes.TrousersColor'] || 'Unknown',
        lowerType: trousersType === 1 ? 'Pants' : (trousersType === 2 ? 'Skirt' : 'Unknown Bottom'),
        sex: human?.Sex || fields['Data.HumanAttributes.Sex'] || 'Unknown',
        age: String(human?.Age || fields['Data.HumanAttributes.Age'] || 'Unknown'),
        hasHat: hasHat === 1 ? 'Yes' : (hasHat === 2 ? 'No' : 'Unknown'),
        hasBag: hasBag === 1 ? 'Yes' : (hasBag === 2 ? 'No' : 'Unknown'),
    };
}

function resolveBoundingScale(data = {}) {
    const region = Array.isArray(data?.DetectRegion) ? data.DetectRegion : [];
    const maxFromRegion = region.flatMap((point) => (Array.isArray(point) ? point : []))
        .reduce((max, value) => {
            const parsed = Number.parseInt(String(value ?? ''), 10);
            return Number.isFinite(parsed) ? Math.max(max, parsed) : max;
        }, 0);
    if (maxFromRegion > 0) return maxFromRegion;
    const candidates = [16383, 8191, 4095, 10000];
    return candidates[1];
}

function pickBestBoundingBox(code, human, vehicle, fields, objectRect) {
    const normalizedCode = String(code || '').toLowerCase();
    const humanBox = normalizeBoundingBox(human?.BoundingBox || fields['Data.HumanAttributes.BoundingBox']);
    const vehicleBox = normalizeBoundingBox(vehicle?.BoundingBox || fields['Data.Vehicle.BoundingBox']);
    const objectBox = normalizeBoundingBox(objectRect);

    if (normalizedCode.includes('vehicle')) {
        return vehicleBox || objectBox || humanBox;
    }
    return humanBox || objectBox || vehicleBox;
}

function mapEventEntriesToCards(entries, channelId, fetchedAt, rawText = '') {
    const baseEntries = (Array.isArray(entries) ? entries : [])
        .filter((entry) => SUPPORTED_CODES_REGEX.test(String(entry?.code || '')));
    const rawEntries = parseAttachEntriesFromRaw(rawText)
        .filter((entry) => SUPPORTED_CODES_REGEX.test(String(entry?.code || '')));
    const sourceEntries = rawEntries.length > 0 ? rawEntries : baseEntries;

    return sourceEntries
        .filter((entry) => DETECTION_EVENT_CODES_LOWER.has(String(entry?.code || '').trim().toLowerCase()))
        .filter((entry) => Boolean(entry?.active))
        .map((entry, index) => {
            const code = String(entry?.code || '');
            const fields = entry?.fields || {};
            const data = entry?.data || {};
            const human = data?.HumanAttributes || {};
            const vehicle = data?.Vehicle || data?.VehicleAttributes || {};
            const objectRect = Array.isArray(data?.object) ? data.object[0]?.Rect : null;

            const sceneWidth = Number.parseInt(String(data?.SceneImage?.Width ?? ''), 10) || 0;
            const sceneHeight = Number.parseInt(String(data?.SceneImage?.Height ?? ''), 10) || 0;
            const box = pickBestBoundingBox(code, human, vehicle, fields, objectRect);
            const boundingScale = resolveBoundingScale(data);
            const humanImageBlob = extractHumanImage(data);

            return {
                id: `${channelId}-${code}-${data?.LocaleTime || fetchedAt || Date.now()}-${index}`,
                channelId: String(channelId),
                time: data?.LocaleTime || data?.UTC || fetchedAt || new Date().toISOString(),
                label: toDetectionLabel(code),
                ...parseHumanTraits(human, fields),
                boundingBox: box,
                sceneWidth,
                sceneHeight,
                boundingScale,
                humanImageBlob,
            };
        });
}

async function fetchChannelSnapshot(channelId) {
    try {
        await warmupDigestChallenge();
        const response = await ApiClient.get(`/cgi-bin/snapshot.cgi?channel=${encodeURIComponent(channelId)}`, {
            timeout: 4500,
            responseType: 'arraybuffer',
            transformResponse: [(value) => value],
            headers: { 'Cache-Control': 'no-cache, no-store', Pragma: 'no-cache' },
        });
        const bytes = new Uint8Array(response?.data || []);
        if (!bytes.length) return null;
        return new Blob([bytes], { type: 'image/jpeg' });
    } catch {
        return null;
    }
}

async function blobToImage(blob) {
    const objectUrl = URL.createObjectURL(blob);
    try {
        return await new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = () => reject(new Error('Failed loading snapshot image.'));
            img.src = objectUrl;
        });
    } finally {
        URL.revokeObjectURL(objectUrl);
    }
}

async function cropSnapshotByBoundingBox(baseSnapshotBlob, boundingBox, options = {}) {
    const box = normalizeBoundingBox(boundingBox);
    if (!baseSnapshotBlob || !box) return null;

    const sourceImage = await blobToImage(baseSnapshotBlob);
    const imageWidth = Number(sourceImage.naturalWidth || sourceImage.width || 0);
    const imageHeight = Number(sourceImage.naturalHeight || sourceImage.height || 0);
    if (!imageWidth || !imageHeight) return null;

    const [left, top, right, bottom] = box;
    const sceneWidth = Number.parseInt(String(options?.sceneWidth ?? ''), 10);
    const sceneHeight = Number.parseInt(String(options?.sceneHeight ?? ''), 10);
    const scale = Number.parseInt(String(options?.boundingScale ?? ''), 10) || 8191;

    let x = (left / scale) * imageWidth;
    let y = (top / scale) * imageHeight;
    let w = ((right - left) / scale) * imageWidth;
    let h = ((bottom - top) / scale) * imageHeight;
    if (sceneWidth > 0 && sceneHeight > 0 && Math.max(left, top, right, bottom) <= Math.max(sceneWidth, sceneHeight) + 32) {
        x = (left / sceneWidth) * imageWidth;
        y = (top / sceneHeight) * imageHeight;
        w = ((right - left) / sceneWidth) * imageWidth;
        h = ((bottom - top) / sceneHeight) * imageHeight;
    }

    const padX = w * 0.22;
    const padTop = h * 0.22;
    const padBottom = h * 0.28;
    let cropX = x - padX;
    let cropY = y - padTop;
    let cropW = Math.max(8, w + (padX * 2));
    let cropH = Math.max(8, h + padTop + padBottom);
    const targetAspect = 92 / 150;
    const currentAspect = cropW / cropH;
    if (currentAspect > targetAspect) {
        const nextH = cropW / targetAspect;
        cropY -= (nextH - cropH) / 2;
        cropH = nextH;
    } else {
        const nextW = cropH * targetAspect;
        cropX -= (nextW - cropW) / 2;
        cropW = nextW;
    }

    cropX = Math.max(0, Math.min(cropX, imageWidth - 2));
    cropY = Math.max(0, Math.min(cropY, imageHeight - 2));
    cropW = Math.min(cropW, imageWidth - cropX);
    cropH = Math.min(cropH, imageHeight - cropY);

    const safeX = Math.floor(cropX);
    const safeY = Math.floor(cropY);
    const safeW = Math.ceil(cropW);
    const safeH = Math.ceil(cropH);
    if (safeW <= 1 || safeH <= 1) return null;

    const canvas = document.createElement('canvas');
    canvas.width = safeW;
    canvas.height = safeH;
    const context = canvas.getContext('2d');
    if (!context) return null;
    context.drawImage(sourceImage, safeX, safeY, safeW, safeH, 0, 0, safeW, safeH);

    return new Promise((resolve) => {
        canvas.toBlob((blob) => resolve(blob || null), 'image/jpeg', 0.92);
    });
}

export const liveDetectionService = Object.freeze({
    DETECTION_EVENT_CODES,
    mapEventEntriesToCards,
    fetchChannelSnapshot,
    cropSnapshotByBoundingBox,
    extractHumanImage,
});
