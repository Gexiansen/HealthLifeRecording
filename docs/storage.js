import {
  createEmptyData,
  migrateV3Data,
  parseData,
  serializeData,
} from "./model.js";
import { parseBackupMetadata } from "./backup.js";

export const STORAGE_KEY = "healthlife:data:v4";
export const LEGACY_STORAGE_KEY = "healthlife:data:v3";
export const BACKUP_META_KEY = "healthlife:backup-meta:v3";

export class StorageWriteError extends Error {
  constructor(cause) {
    super("本地数据保存失败");
    this.name = "StorageWriteError";
    this.cause = cause;
  }
}

export function loadData(storage = globalThis.localStorage) {
  let raw;
  try {
    raw = storage.getItem(STORAGE_KEY);
  } catch (error) {
    return {
      status: "unavailable",
      data: null,
      raw: null,
      error,
    };
  }

  if (raw === null) {
    let legacyRaw;
    try {
      legacyRaw = storage.getItem(LEGACY_STORAGE_KEY);
    } catch (error) {
      return {
        status: "unavailable",
        data: null,
        raw: null,
        error,
      };
    }
    if (legacyRaw !== null) {
      try {
        return {
          status: "migrated",
          data: migrateV3Data(JSON.parse(legacyRaw)),
          raw: legacyRaw,
          error: null,
        };
      } catch (error) {
        return {
          status: "legacy-corrupt",
          data: null,
          raw: legacyRaw,
          error,
        };
      }
    }
    return {
      status: "empty",
      data: createEmptyData(),
      raw: null,
      error: null,
    };
  }

  try {
    return {
      status: "ready",
      data: parseData(raw),
      raw,
      error: null,
    };
  } catch (error) {
    return {
      status: "corrupt",
      data: null,
      raw,
      error,
    };
  }
}

export function saveData(data, storage = globalThis.localStorage) {
  const serialized = serializeData(data);
  try {
    storage.setItem(STORAGE_KEY, serialized);
  } catch (error) {
    throw new StorageWriteError(error);
  }
  return serialized;
}

export function loadBackupMetadata(storage = globalThis.localStorage) {
  try {
    return parseBackupMetadata(storage.getItem(BACKUP_META_KEY));
  } catch {
    return null;
  }
}

export function saveBackupMetadata(metadata, storage = globalThis.localStorage) {
  try {
    storage.setItem(BACKUP_META_KEY, JSON.stringify(metadata));
  } catch (error) {
    throw new StorageWriteError(error);
  }
}
