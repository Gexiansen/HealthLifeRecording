import { createEmptyData, parseData, serializeData } from "./model.js";

export const STORAGE_KEY = "healthlife:data:v1";

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
