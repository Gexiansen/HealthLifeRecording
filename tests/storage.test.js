import test from "node:test";
import assert from "node:assert/strict";
import { createEmptyData, serializeData } from "../docs/model.js";
import { createWorkoutDraft, createWorkoutUndoHistory, pushWorkoutUndoSnapshot } from "../docs/guided-workout.js";
import {
  BACKUP_META_KEY,
  clearWorkoutUndoHistory,
  loadData,
  loadWorkoutUndoHistory,
  saveData,
  saveWorkoutUndoHistory,
  LEGACY_STORAGE_KEY,
  PREVIOUS_STORAGE_KEY,
  STORAGE_KEY,
  StorageWriteError,
  WORKOUT_UNDO_KEY,
} from "../docs/storage.js";
import { v10Meal, v11Workout } from "./helpers.js";

function memoryStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (key) => map.has(key) ? map.get(key) : null,
    setItem: (key, value) => map.set(key, value),
    removeItem: (key) => map.delete(key),
    map,
  };
}

test("schema v12 使用独立键且空存储不读取 v1 至 v9", () => {
  assert.equal(STORAGE_KEY, "healthlife:data:v12");
  assert.equal(PREVIOUS_STORAGE_KEY, "healthlife:data:v11");
  assert.equal(LEGACY_STORAGE_KEY, "healthlife:data:v10");
  assert.equal(BACKUP_META_KEY, "healthlife:backup-meta:v12");
  const storage = memoryStorage({ "healthlife:data:v9": JSON.stringify({ schemaVersion: 9 }) });
  const result = loadData(storage);
  assert.equal(result.status, "empty");
  assert.equal(result.data.schemaVersion, 12);
});

test("v12 数据可保存读取，损坏内容停止写入假成功", () => {
  const storage = memoryStorage();
  saveData(createEmptyData(), storage);
  assert.equal(loadData(storage).status, "ready");
  storage.setItem(STORAGE_KEY, "not-json");
  assert.equal(loadData(storage).status, "corrupt");
  const failing = { setItem() { throw new Error("quota"); } };
  assert.throws(() => saveData(createEmptyData(), failing), StorageWriteError);
});

test("有效 v11 本地数据迁移到 v12 并保留原键", () => {
  const v11 = createEmptyData();
  v11.schemaVersion = 11;
  v11.workouts = [v11Workout()];
  const original = JSON.stringify(v11);
  const storage = memoryStorage({ [PREVIOUS_STORAGE_KEY]: original });
  const result = loadData(storage);
  assert.equal(result.status, "ready");
  assert.equal(result.migratedFromVersion, 11);
  assert.equal(result.data.schemaVersion, 12);
  assert.equal(result.data.workouts[0].scenario, "running");
  assert.equal(storage.getItem(PREVIOUS_STORAGE_KEY), original);
  assert.equal(storage.getItem(STORAGE_KEY), serializeData(result.data));
});

test("缺少 v11 时，有效 v10 本地数据链式迁移到 v12 并保留原键", () => {
  const v10 = {
    schemaVersion: 10,
    weeklyTraining: [...createEmptyData().weeklyTraining],
    workouts: [],
    meals: [v10Meal()],
    sleepRecords: [],
    weights: [],
  };
  const storage = memoryStorage({ [LEGACY_STORAGE_KEY]: JSON.stringify(v10) });
  const result = loadData(storage);
  assert.equal(result.status, "ready");
  assert.equal(result.migratedFromVersion, 10);
  assert.equal(result.data.schemaVersion, 12);
  assert.equal(result.data.meals[0].freeText, v10.meals[0].content);
  assert.equal(storage.getItem(LEGACY_STORAGE_KEY), JSON.stringify(v10));
  assert.equal(storage.getItem(STORAGE_KEY), serializeData(result.data));
});

test("v11 迁移写入失败时保留原数据并进入只读失败状态", () => {
  const v11 = createEmptyData();
  v11.schemaVersion = 11;
  v11.workouts = [];
  const original = JSON.stringify(v11);
  const storage = memoryStorage({ [PREVIOUS_STORAGE_KEY]: original });
  const originalSet = storage.setItem;
  storage.setItem = (key, value) => {
    if (key === STORAGE_KEY) throw new Error("quota");
    originalSet(key, value);
  };
  const result = loadData(storage);
  assert.equal(result.status, "migrationFailed");
  assert.equal(result.data.schemaVersion, 12);
  assert.equal(result.raw, original);
  assert.equal(storage.getItem(PREVIOUS_STORAGE_KEY), original);
  assert.equal(storage.getItem(STORAGE_KEY), null);
});

test("v12 键损坏时不回退到旧键覆盖异常事实", () => {
  const storage = memoryStorage({
    [STORAGE_KEY]: "not-json",
    [PREVIOUS_STORAGE_KEY]: JSON.stringify({
      ...createEmptyData(),
      schemaVersion: 11,
    }),
  });
  const result = loadData(storage);
  assert.equal(result.status, "corrupt");
  assert.equal(result.raw, "not-json");
  assert.equal(result.data, null);
});

test("v11 键损坏时不继续回退到 v10", () => {
  const storage = memoryStorage({
    [PREVIOUS_STORAGE_KEY]: "not-json",
    [LEGACY_STORAGE_KEY]: JSON.stringify({
      schemaVersion: 10,
      weeklyTraining: [...createEmptyData().weeklyTraining],
      workouts: [], meals: [], sleepRecords: [], weights: [],
    }),
  });
  const result = loadData(storage);
  assert.equal(result.status, "corrupt");
  assert.equal(result.raw, "not-json");
  assert.equal(result.data, null);
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
