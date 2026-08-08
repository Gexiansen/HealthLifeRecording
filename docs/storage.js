import {
  createEmptyData,
  parseData,
  serializeData,
} from "./model.js?v=24";
import { parseBackupMetadata } from "./backup.js?v=24";
import {
  assertValidWorkoutUndoHistory,
  assertValidWorkoutDraft,
  migrateWorkoutDraftV1,
} from "./guided-workout.js?v=24";

export const STORAGE_KEY = "healthlife:data:v10";
export const BACKUP_META_KEY = "healthlife:backup-meta:v10";
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
