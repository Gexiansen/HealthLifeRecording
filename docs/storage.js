import {
  createEmptyData,
  migrateDataV10,
  migrateDataV11,
  parseData,
  parseDataV10,
  parseDataV11,
  serializeData,
} from "./model.js?v=36";
import { parseBackupMetadata } from "./backup.js?v=36";
import {
  assertValidWorkoutUndoHistory,
  assertValidWorkoutDraft,
  migrateWorkoutDraftV1,
} from "./guided-workout.js?v=36";

export const STORAGE_KEY = "healthlife:data:v12";
export const PREVIOUS_STORAGE_KEY = "healthlife:data:v11";
export const LEGACY_STORAGE_KEY = "healthlife:data:v10";
export const BACKUP_META_KEY = "healthlife:backup-meta:v12";
export const WORKOUT_DRAFT_KEY = "healthlife:workout-draft:v2";
export const PREVIOUS_WORKOUT_DRAFT_KEY = "healthlife:workout-draft:v1";
export const WORKOUT_UNDO_KEY = "healthlife:workout-undo:v1";

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

  if (raw !== null) {
    try {
      return {
        status: "ready",
        data: parseData(raw),
        raw,
        error: null,
        migratedFromVersion: null,
      };
    } catch (error) {
      return {
        status: "corrupt",
        data: null,
        raw,
        error,
        migratedFromVersion: null,
      };
    }
  }

  let previousRaw;
  try {
    previousRaw = storage.getItem(PREVIOUS_STORAGE_KEY);
  } catch (error) {
    return { status: "unavailable", data: null, raw: null, error };
  }
  let sourceVersion = 11;
  if (previousRaw === null) {
    try {
      previousRaw = storage.getItem(LEGACY_STORAGE_KEY);
    } catch (error) {
      return { status: "unavailable", data: null, raw: null, error };
    }
    sourceVersion = 10;
  }
  if (previousRaw === null) {
    return {
      status: "empty",
      data: createEmptyData(),
      raw: null,
      error: null,
      migratedFromVersion: null,
    };
  }

  let migrated;
  try {
    migrated = sourceVersion === 11
      ? migrateDataV11(parseDataV11(previousRaw))
      : migrateDataV10(parseDataV10(previousRaw));
  } catch (error) {
    return {
      status: "corrupt",
      data: null,
      raw: previousRaw,
      error,
      migratedFromVersion: null,
    };
  }
  const serialized = serializeData(migrated);
  try {
    storage.setItem(STORAGE_KEY, serialized);
  } catch (error) {
    return {
      status: "migrationFailed",
      data: migrated,
      raw: previousRaw,
      error,
      migratedFromVersion: sourceVersion,
    };
  }
  return {
    status: "ready",
    data: migrated,
    raw: serialized,
    error: null,
    migratedFromVersion: sourceVersion,
  };
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

export function loadWorkoutUndoHistory(currentDraft, storage = globalThis.localStorage) {
  if (currentDraft === null) return { status: "empty", history: null, error: null };
  let raw;
  try {
    raw = storage.getItem(WORKOUT_UNDO_KEY);
  } catch (error) {
    return { status: "unavailable", history: null, error };
  }
  if (raw === null) return { status: "empty", history: null, error: null };
  try {
    const history = JSON.parse(raw);
    assertValidWorkoutUndoHistory(history, currentDraft);
    return { status: "ready", history, error: null };
  } catch (error) {
    return { status: "corrupt", history: null, error };
  }
}

export function saveWorkoutUndoHistory(history, storage = globalThis.localStorage) {
  assertValidWorkoutUndoHistory(history);
  try {
    storage.setItem(WORKOUT_UNDO_KEY, JSON.stringify(history));
  } catch (error) {
    throw new StorageWriteError(error);
  }
}

export function clearWorkoutUndoHistory(storage = globalThis.localStorage) {
  try {
    storage.removeItem(WORKOUT_UNDO_KEY);
  } catch (error) {
    throw new StorageWriteError(error);
  }
}
