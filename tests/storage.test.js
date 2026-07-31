import test from "node:test";
import assert from "node:assert/strict";
import { createEmptyData } from "../docs/model.js";
import { createWorkoutDraft, createWorkoutUndoHistory, pushWorkoutUndoSnapshot } from "../docs/guided-workout.js";
import {
  BACKUP_META_KEY,
  clearWorkoutUndoHistory,
  loadData,
  loadWorkoutUndoHistory,
  saveData,
  saveWorkoutUndoHistory,
  STORAGE_KEY,
  StorageWriteError,
  WORKOUT_UNDO_KEY,
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

test("训练撤销历史使用独立键保存并严格匹配当前草稿", () => {
  const storage = memoryStorage();
  const draft = createWorkoutDraft({
    templateId: "squatAdaptation",
    date: "2026-07-31",
    id: "10000000-0000-4000-8000-000000000001",
    now: "2026-07-31T10:00:00.000Z",
  });
  const history = pushWorkoutUndoSnapshot(createWorkoutUndoHistory(draft), draft);
  saveWorkoutUndoHistory(history, storage);
  assert.equal(WORKOUT_UNDO_KEY, "healthlife:workout-undo:v1");
  assert.deepEqual(loadWorkoutUndoHistory(draft, storage), {
    status: "ready",
    history,
    error: null,
  });
  const otherDraft = { ...draft, id: "20000000-0000-4000-8000-000000000002" };
  assert.equal(loadWorkoutUndoHistory(otherDraft, storage).status, "corrupt");
  clearWorkoutUndoHistory(storage);
  assert.equal(storage.getItem(WORKOUT_UNDO_KEY), null);
});
