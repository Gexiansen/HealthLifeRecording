import {
  assertValidData,
  createEmptyData,
  migrateDataV10,
  migrateDataV11,
  parseData,
  parseDataV10,
  parseDataV11,
  serializeData,
} from "./model.js?v=27";
import { COLLECTIONS } from "./data.js?v=27";

export const BACKUP_FORMAT = "healthlife-complete-backup";
export const BACKUP_VERSION = 12;
export const PREVIOUS_BACKUP_VERSION = 11;
export const LEGACY_BACKUP_VERSION = 10;

export function createCompleteBackup(data, exportedAt = new Date().toISOString()) {
  assertValidData(data);
  assertIsoTimestamp(exportedAt, "exportedAt");
  return {
    format: BACKUP_FORMAT,
    backupVersion: BACKUP_VERSION,
    exportedAt,
    data: JSON.parse(serializeData(data)),
  };
}

export function serializeCompleteBackup(data, exportedAt) {
  return JSON.stringify(createCompleteBackup(data, exportedAt), null, 2);
}

export function parseCompleteBackup(text) {
  if (typeof text !== "string") throw new TypeError("备份内容必须是字符串");
  let backup;
  try {
    backup = JSON.parse(text);
  } catch {
    throw new TypeError("备份内容不是有效 JSON");
  }
  assertExactKeys(backup, ["format", "backupVersion", "exportedAt", "data"], "backup");
  if (backup.format !== BACKUP_FORMAT) throw new TypeError("不是 HealthLife 完整备份");
  if (![LEGACY_BACKUP_VERSION, PREVIOUS_BACKUP_VERSION, BACKUP_VERSION].includes(backup.backupVersion)) {
    throw new TypeError(`不支持的 backupVersion：${String(backup.backupVersion)}`);
  }
  assertIsoTimestamp(backup.exportedAt, "backup.exportedAt");
  const sourceBackupVersion = backup.backupVersion;
  const serializedData = JSON.stringify(backup.data);
  let data;
  if (sourceBackupVersion === BACKUP_VERSION) {
    data = parseData(serializedData);
  } else if (sourceBackupVersion === PREVIOUS_BACKUP_VERSION) {
    data = migrateDataV11(parseDataV11(serializedData));
  } else {
    data = migrateDataV10(parseDataV10(serializedData));
  }
  return {
    backup: { ...backup, backupVersion: BACKUP_VERSION, data },
    sourceBackupVersion,
    summary: summarizeData(data),
  };
}

export function summarizeData(data) {
  assertValidData(data);
  const recordDates = COLLECTIONS.flatMap(
    (collectionName) => data[collectionName].map((record) => record.date),
  );
  const dates = [...recordDates].sort();
  const counts = Object.fromEntries(COLLECTIONS.map((collectionName) => [collectionName, data[collectionName].length]));
  return {
    totalRecords: recordDates.length,
    firstDate: dates[0] ?? null,
    lastDate: dates.at(-1) ?? null,
    counts,
    weeklyTraining: [...data.weeklyTraining],
    foodCount: data.foods.length,
    healthStageCount: data.healthStages.length,
  };
}

export function createBackupMetadata(lastBackupAt, data) {
  assertIsoTimestamp(lastBackupAt, "lastBackupAt");
  const summary = summarizeData(data);
  return {
    version: 4,
    lastBackupAt,
    recordCount: summary.totalRecords,
    settingsSignature: createSignature({
      weeklyTraining: data.weeklyTraining,
      foods: data.foods,
      healthStages: data.healthStages,
    }),
  };
}

export function parseBackupMetadata(text) {
  if (text === null) return null;
  let metadata;
  try {
    metadata = JSON.parse(text);
  } catch {
    return null;
  }
  try {
    assertExactKeys(
      metadata,
      ["version", "lastBackupAt", "recordCount", "settingsSignature"],
      "metadata",
    );
    if (
      metadata.version !== 4
      || !Number.isInteger(metadata.recordCount)
      || metadata.recordCount < 0
      || typeof metadata.settingsSignature !== "string"
    ) return null;
    assertIsoTimestamp(metadata.lastBackupAt, "metadata.lastBackupAt");
    return metadata;
  } catch {
    return null;
  }
}

export function getBackupReminder(data, metadata, now = new Date().toISOString()) {
  const recordCount = summarizeData(data).totalRecords;
  const defaults = createEmptyData();
  const hasSettingsChanges = data.foods.length > 0
    || data.healthStages.length > 0
    || JSON.stringify(data.weeklyTraining) !== JSON.stringify(defaults.weeklyTraining);
  if (recordCount === 0 && !hasSettingsChanges) return { needed: false, reason: "empty" };
  if (!metadata) return { needed: true, reason: "never" };
  assertIsoTimestamp(now, "now");
  const ageDays = Math.floor((Date.parse(now) - Date.parse(metadata.lastBackupAt)) / 86_400_000);
  if (ageDays >= 14) return { needed: true, reason: "stale" };
  if (recordCount - metadata.recordCount >= 10) return { needed: true, reason: "manyChanges" };
  const currentSettingsSignature = createSignature({
    weeklyTraining: data.weeklyTraining,
    foods: data.foods,
    healthStages: data.healthStages,
  });
  if (metadata.settingsSignature !== currentSettingsSignature) {
    return { needed: true, reason: "settingsChanges" };
  }
  return { needed: false, reason: "current" };
}

function createSignature(value) {
  const text = JSON.stringify(value);
  let hash = 2_166_136_261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function assertExactKeys(value, expectedKeys, path) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${path} 必须是对象`);
  }
  const actual = Object.keys(value).sort();
  const expected = [...expectedKeys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    throw new TypeError(`${path} 字段不完整或包含未知字段`);
  }
}

function assertIsoTimestamp(value, path) {
  if (typeof value !== "string") throw new TypeError(`${path} 必须是 ISO 8601 时间戳`);
  const date = new Date(value);
  if (Number.isNaN(date.getTime()) || date.toISOString() !== value) {
    throw new TypeError(`${path} 必须是标准 UTC ISO 8601 时间戳`);
  }
}
