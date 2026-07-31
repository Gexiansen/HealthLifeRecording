import test from "node:test";
import assert from "node:assert/strict";
import { createEmptyData } from "../docs/model.js";
import {
  BACKUP_META_KEY,
  loadData,
  saveData,
  STORAGE_KEY,
  StorageWriteError,
} from "../docs/storage.js";

function memoryStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (key) => map.has(key) ? map.get(key) : null,
    setItem: (key, value) => map.set(key, value),
    removeItem: (key) => map.delete(key),
    map,
  };
}

test("schema v8 使用独立键并且不读取 v1 至 v7", () => {
  assert.equal(STORAGE_KEY, "healthlife:data:v8");
  assert.equal(BACKUP_META_KEY, "healthlife:backup-meta:v8");
  const storage = memoryStorage({ "healthlife:data:v7": JSON.stringify({ schemaVersion: 7 }) });
  const result = loadData(storage);
  assert.equal(result.status, "empty");
  assert.equal(result.data.schemaVersion, 8);
});

test("v8 数据可保存读取，损坏内容停止写入假成功", () => {
  const storage = memoryStorage();
  saveData(createEmptyData(), storage);
  assert.equal(loadData(storage).status, "ready");
  storage.setItem(STORAGE_KEY, "not-json");
  assert.equal(loadData(storage).status, "corrupt");
  const failing = { setItem() { throw new Error("quota"); } };
  assert.throws(() => saveData(createEmptyData(), failing), StorageWriteError);
});
