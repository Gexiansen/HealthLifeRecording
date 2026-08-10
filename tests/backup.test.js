import test from "node:test";
import assert from "node:assert/strict";
import { createEmptyData } from "../docs/model.js";
import {
  BACKUP_VERSION,
  createBackupMetadata,
  getBackupReminder,
  parseCompleteBackup,
  serializeCompleteBackup,
  summarizeData,
} from "../docs/backup.js";
import { food, v10Meal, v11Workout, weight } from "./helpers.js";

const NOW = "2026-07-31T00:00:00.000Z";

test("v12 完整备份严格往返并汇总记录和个人配置", () => {
  const data = createEmptyData();
  data.weights.push(weight());
  data.foods.push(food());
  const result = parseCompleteBackup(serializeCompleteBackup(data, NOW));
  assert.equal(BACKUP_VERSION, 12);
  assert.deepEqual(result.backup.data, data);
  assert.deepEqual(result.summary.counts, {
    workouts: 0, meals: 0, sleepRecords: 0, weights: 1,
  });
  assert.equal(result.summary.totalRecords, 1);
  assert.equal(result.summary.foodCount, 1);
});

test("备份拒绝 v1 至 v9，并拒绝未知字段", () => {
  const data = createEmptyData();
  const valid = JSON.parse(serializeCompleteBackup(data, NOW));
  for (let version = 1; version <= 9; version += 1) {
    assert.throws(() => parseCompleteBackup(JSON.stringify({ ...valid, backupVersion: version })), /backupVersion/);
  }
  valid.data.hydration = [];
  assert.throws(() => parseCompleteBackup(JSON.stringify(valid)), /未知字段/);
});

test("有效 v11 完整备份整体迁移为 v12，并映射运动场景", () => {
  const v11Data = createEmptyData();
  v11Data.schemaVersion = 11;
  v11Data.workouts = [v11Workout()];
  const result = parseCompleteBackup(JSON.stringify({
    format: "healthlife-complete-backup",
    backupVersion: 11,
    exportedAt: NOW,
    data: v11Data,
  }));
  assert.equal(result.sourceBackupVersion, 11);
  assert.equal(result.backup.backupVersion, 12);
  assert.equal(result.backup.data.schemaVersion, 12);
  assert.equal(result.backup.data.workouts[0].scenario, "running");
});

test("有效 v10 完整备份整体迁移为 v12，旧饮食不生成蛋白质估算", () => {
  const v10Data = {
    schemaVersion: 10,
    weeklyTraining: [...createEmptyData().weeklyTraining],
    workouts: [],
    meals: [v10Meal()],
    sleepRecords: [],
    weights: [],
  };
  const result = parseCompleteBackup(JSON.stringify({
    format: "healthlife-complete-backup",
    backupVersion: 10,
    exportedAt: NOW,
    data: v10Data,
  }));
  assert.equal(result.sourceBackupVersion, 10);
  assert.equal(result.backup.backupVersion, 12);
  assert.equal(result.backup.data.schemaVersion, 12);
  assert.deepEqual(result.backup.data.meals[0].foodItems, []);
  assert.equal(result.backup.data.meals[0].freeText, v10Data.meals[0].content);
});

test("备份提醒覆盖记录变化和每周模板变化", () => {
  const empty = createEmptyData();
  assert.deepEqual(getBackupReminder(empty, null), { needed: false, reason: "empty" });
  empty.weights.push(weight());
  assert.equal(getBackupReminder(empty, null).reason, "never");
  const metadata = createBackupMetadata(NOW, empty);
  assert.equal(getBackupReminder(empty, metadata, "2026-08-01T00:00:00.000Z").needed, false);
  const templateChanged = structuredClone(empty);
  templateChanged.weeklyTraining[0] = "runWalk";
  assert.equal(getBackupReminder(templateChanged, metadata, "2026-08-01T00:00:00.000Z").reason, "settingsChanges");
  assert.equal(summarizeData(templateChanged).weeklyTraining[0], "runWalk");
});
