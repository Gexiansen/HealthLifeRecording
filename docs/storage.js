import {
  createEmptyData,
  parseData,
  serializeData,
} from "./model.js?v=16";
import { parseBackupMetadata } from "./backup.js?v=16";
import {
  assertValidWorkoutDraft,
  migrateWorkoutDraftV1,
} from "./guided-workout.js?v=16";

export const STORAGE_KEY = "healthlife:data:v8";
export const BACKUP_META_KEY = "healthlife:backup-meta:v8";
export const WORKOUT_DRAFT_KEY = "healthlife:workout-draft:v2";
export const PREVIOUS_WORKOUT_DRAFT_KEY = "healthlife:workout-draft:v1";

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
  let isPreviousVersion = false;
  try {
    raw = storage.getItem(WORKOUT_DRAFT_KEY);
    if (raw === null) {
      raw = storage.getItem(PREVIOUS_WORKOUT_DRAFT_KEY);
      isPreviousVersion = raw !== null;
    }
  } catch (error) {
    return { status: "unavailable", draft: null, error };
  }
  if (raw === null) return { status: "empty", draft: null, error: null };
  try {
    const parsed = JSON.parse(raw);
    const draft = isPreviousVersion ? migrateWorkoutDraftV1(parsed) : parsed;
    assertValidWorkoutDraft(draft);
    if (isPreviousVersion) {
      storage.setItem(WORKOUT_DRAFT_KEY, JSON.stringify(draft));
    }
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
