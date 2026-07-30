import test from "node:test";
import assert from "node:assert/strict";

import {
  BACKUP_META_KEY,
  clearWorkoutDraft,
  LEGACY_STORAGE_KEY,
  loadBackupMetadata,
  loadData,
  loadWorkoutDraft,
  PREVIOUS_STORAGE_KEY,
  PREVIOUS_WORKOUT_DRAFT_KEY,
  saveBackupMetadata,
  saveData,
  saveWorkoutDraft,
  STORAGE_KEY,
  StorageWriteError,
  WORKOUT_DRAFT_KEY,
} from "../docs/storage.js";
import { createBackupMetadata } from "../docs/backup.js";
import { createEmptyData } from "../docs/model.js";
import { createWorkoutDraft } from "../docs/guided-workout.js";

test("schema v7 使用独立存储键并保留 v6 与 v5 迁移来源", () => {
  assert.equal(STORAGE_KEY, "healthlife:data:v7");
  assert.equal(PREVIOUS_STORAGE_KEY, "healthlife:data:v6");
  assert.equal(LEGACY_STORAGE_KEY, "healthlife:data:v5");
  assert.equal(BACKUP_META_KEY, "healthlife:backup-meta:v7");
});

function memoryStorage(initial = null) {
  const values = new Map([
    [STORAGE_KEY, initial],
  ]);
  return {
    getItem(key) {
      return values.get(key) ?? null;
    },
    setItem(key, next) {
      assert.equal(key, STORAGE_KEY);
      values.set(key, next);
    },
  };
}

test("空存储返回新的 schema v7 数据但不立即写入", () => {
  const storage = memoryStorage();
  const result = loadData(storage);
  assert.equal(result.status, "empty");
  assert.deepEqual(result.data, createEmptyData());
  assert.equal(storage.getItem(STORAGE_KEY), null);
});

test("有效内容保存后可以重新读取", () => {
  const storage = memoryStorage();
  const data = createEmptyData();
  const serialized = saveData(data, storage);
  assert.equal(storage.getItem(STORAGE_KEY), serialized);
  assert.deepEqual(loadData(storage), {
    status: "ready",
    data,
    raw: serialized,
    error: null,
  });
});

test("没有 v7 数据时自动迁移有效 v6 数据且保留旧键", () => {
  const v6 = createEmptyData();
  v6.schemaVersion = 6;
  const values = new Map([[PREVIOUS_STORAGE_KEY, JSON.stringify(v6)]]);
  const storage = {
    getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) { values.set(key, value); },
  };
  const result = loadData(storage);
  assert.equal(result.status, "ready");
  assert.equal(result.data.schemaVersion, 7);
  assert.equal(values.has(STORAGE_KEY), true);
  assert.equal(values.has(PREVIOUS_STORAGE_KEY), true);
});

test("没有 v7 或 v6 数据时自动迁移有效 v5 数据且保留旧键", () => {
  const v5 = createEmptyData();
  v5.schemaVersion = 5;
  const values = new Map([[LEGACY_STORAGE_KEY, JSON.stringify(v5)]]);
  const storage = {
    getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) { values.set(key, value); },
  };
  const result = loadData(storage);
  assert.equal(result.status, "ready");
  assert.equal(result.data.schemaVersion, 7);
  assert.equal(values.has(STORAGE_KEY), true);
  assert.equal(values.has(LEGACY_STORAGE_KEY), true);
});

test("损坏内容保留原文并进入写入锁定状态", () => {
  const raw = "{broken";
  const result = loadData(memoryStorage(raw));
  assert.equal(result.status, "corrupt");
  assert.equal(result.data, null);
  assert.equal(result.raw, raw);
  assert.match(result.error.message, /有效 JSON/);
});

test("读取不可用和保存失败返回明确错误", () => {
  const readError = new Error("blocked");
  const unavailable = loadData({
    getItem() {
      throw readError;
    },
  });
  assert.equal(unavailable.status, "unavailable");
  assert.equal(unavailable.error, readError);

  assert.throws(
    () =>
      saveData(createEmptyData(), {
        setItem() {
          throw new Error("quota");
        },
      }),
    StorageWriteError,
  );
});

test("备份提醒元数据使用独立版本化键并容忍损坏内容", () => {
  const values = new Map();
  const storage = {
    getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) { values.set(key, value); },
  };
  const metadata = createBackupMetadata("2026-07-23T09:00:00.000Z", createEmptyData());
  saveBackupMetadata(metadata, storage);
  assert.equal(values.has(BACKUP_META_KEY), true);
  assert.deepEqual(loadBackupMetadata(storage), metadata);
  values.set(BACKUP_META_KEY, "{broken");
  assert.equal(loadBackupMetadata(storage), null);
});

test("引导式训练草稿可以保存、恢复和清除", () => {
  const values = new Map();
  const storage = {
    getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) { values.set(key, value); },
    removeItem(key) { values.delete(key); },
  };
  const draft = createWorkoutDraft({
    templateId: "squatAdaptation",
    date: "2026-07-31",
    id: "10000000-0000-4000-8000-000000000001",
    now: "2026-07-31T10:00:00.000Z",
  });
  saveWorkoutDraft(draft, storage);
  assert.equal(values.has(WORKOUT_DRAFT_KEY), true);
  assert.deepEqual(loadWorkoutDraft(storage), {
    status: "ready",
    draft,
    error: null,
  });
  clearWorkoutDraft(storage);
  assert.deepEqual(loadWorkoutDraft(storage), {
    status: "empty",
    draft: null,
    error: null,
  });
});

test("v1 引导式训练草稿会迁移到 v2 且保留旧键", () => {
  const draft = createWorkoutDraft({
    templateId: "squatAdaptation",
    date: "2026-07-31",
    id: "10000000-0000-4000-8000-000000000001",
    now: "2026-07-31T10:00:00.000Z",
  });
  const { exerciseReplacements, ...v1 } = draft;
  v1.draftVersion = 1;
  const values = new Map([[PREVIOUS_WORKOUT_DRAFT_KEY, JSON.stringify(v1)]]);
  const storage = {
    getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) { values.set(key, value); },
  };
  const result = loadWorkoutDraft(storage);
  assert.equal(result.status, "ready");
  assert.equal(result.draft.draftVersion, 2);
  assert.equal(values.has(WORKOUT_DRAFT_KEY), true);
  assert.equal(values.has(PREVIOUS_WORKOUT_DRAFT_KEY), true);
});
