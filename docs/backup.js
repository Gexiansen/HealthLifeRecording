import {
  assertValidData,
  createEmptyData,
  parseData,
  serializeData,
} from "./model.js?v=17";
import { COLLECTIONS } from "./data.js?v=17";

export const BACKUP_FORMAT = "healthlife-complete-backup";
export const BACKUP_VERSION = 8;

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
  if (backup.backupVersion !== BACKUP_VERSION) {
    throw new TypeError(`不支持的 backupVersion：${String(backup.backupVersion)}`);
  }
  assertIsoTimestamp(backup.exportedAt, "backup.exportedAt");
  const data = parseData(JSON.stringify(backup.data));
  return {
    backup: { ...backup, backupVersion: BACKUP_VERSION, data },
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
  };
}

export function createBackupMetadata(lastBackupAt, data) {
  assertIsoTimestamp(lastBackupAt, "lastBackupAt");
  const summary = summarizeData(data);
  return {
    version: 3,
    lastBackupAt,
    recordCount: summary.totalRecords,
    weeklyTrainingSignature: createSignature(data.weeklyTraining),
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
      ["version", "lastBackupAt", "recordCount", "weeklyTrainingSignature"],
      "metadata",
    );
    if (
      metadata.version !== 3
      || !Number.isInteger(metadata.recordCount)
      || metadata.recordCount < 0
      || typeof metadata.weeklyTrainingSignature !== "string"
    ) return null;
    assertIsoTimestamp(metadata.lastBackupAt, "metadata.lastBackupAt");
    return metadata;
  } catch {
    return null;
  }
}

export function getBackupReminder(data, metadata, now = new Date().toISOString()) {
  const recordCount = summarizeData(data).totalRecords;
  const hasTemplateChanges = JSON.stringify(data.weeklyTraining)
    !== JSON.stringify(createEmptyData().weeklyTraining);
  if (recordCount === 0 && !hasTemplateChanges) return { needed: false, reason: "empty" };
  if (!metadata) return { needed: true, reason: "never" };
  assertIsoTimestamp(now, "now");
  const ageDays = Math.floor((Date.parse(now) - Date.parse(metadata.lastBackupAt)) / 86_400_000);
  if (ageDays >= 14) return { needed: true, reason: "stale" };
  if (recordCount - metadata.recordCount >= 10) return { needed: true, reason: "manyChanges" };
  if (metadata.weeklyTrainingSignature !== createSignature(data.weeklyTraining)) {
    return { needed: true, reason: "templateChanges" };
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
