import {
  createEmptyData,
  migrateV5Data,
  parseData,
  serializeData,
} from "./model.js";
import { parseBackupMetadata } from "./backup.js";
import { assertValidWorkoutDraft } from "./guided-workout.js";

export const STORAGE_KEY = "healthlife:data:v6";
export const PREVIOUS_STORAGE_KEY = "healthlife:data:v5";
export const BACKUP_META_KEY = "healthlife:backup-meta:v6";
export const WORKOUT_DRAFT_KEY = "healthlife:workout-draft:v1";

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
    let previousRaw;
    try {
      previousRaw = storage.getItem(PREVIOUS_STORAGE_KEY);
    } catch (error) {
      return { status: "unavailable", data: null, raw: null, error };
    }
    if (previousRaw !== null) {
      try {
        const migrated = migrateV5Data(JSON.parse(previousRaw));
        const serialized = serializeData(migrated);
        storage.setItem(STORAGE_KEY, serialized);
        return {
          status: "ready",
          data: migrated,
          raw: serialized,
          error: null,
        };
      } catch (error) {
        return {
          status: "corrupt",
          data: null,
          raw: previousRaw,
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

export function loadWorkoutDraft(storage = globalThis.localStorage) {
  let raw;
  try {
    raw = storage.getItem(WORKOUT_DRAFT_KEY);
  } catch (error) {
    return { status: "unavailable", draft: null, error };
  }
  if (raw === null) return { status: "empty", draft: null, error: null };
  try {
    const draft = JSON.parse(raw);
    assertValidWorkoutDraft(draft);
    return { status: "ready", draft, error: null };
  } catch (error) {
    return { status: "corrupt", draft: null, error };
  }
}

export function saveWorkoutDraft(draft, storage = globalThis.localStorage) {
  assertValidWorkoutDraft(draft);
  try {
    storage.setItem(WORKOUT_DRAFT_KEY, JSON.stringify(draft));
  } catch (error) {
    throw new StorageWriteError(error);
  }
}

export function clearWorkoutDraft(storage = globalThis.localStorage) {
  try {
    storage.removeItem(WORKOUT_DRAFT_KEY);
  } catch (error) {
    throw new StorageWriteError(error);
  }
}
