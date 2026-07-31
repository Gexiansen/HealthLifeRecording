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
import { weight } from "./helpers.js";

const NOW = "2026-07-31T00:00:00.000Z";

test("v8 完整备份严格往返并只汇总四类记录", () => {
  const data = createEmptyData();
  data.weights.push(weight());
  const result = parseCompleteBackup(serializeCompleteBackup(data, NOW));
  assert.equal(BACKUP_VERSION, 8);
  assert.deepEqual(result.backup.data, data);
  assert.deepEqual(result.summary.counts, {
    workouts: 0, meals: 0, sleepRecords: 0, weights: 1,
  });
  assert.equal(result.summary.totalRecords, 1);
});

test("备份拒绝 v1 至 v7、未知字段与无效 v8 数据", () => {
  const data = createEmptyData();
  const valid = JSON.parse(serializeCompleteBackup(data, NOW));
  for (let version = 1; version <= 7; version += 1) {
    assert.throws(() => parseCompleteBackup(JSON.stringify({ ...valid, backupVersion: version })), /backupVersion/);
  }
  valid.data.hydration = [];
  assert.throws(() => parseCompleteBackup(JSON.stringify(valid)), /未知字段/);
});

test("备份提醒覆盖记录变化和每周模板变化", () => {
  const empty = createEmptyData();
  assert.deepEqual(getBackupReminder(empty, null), { needed: false, reason: "empty" });
  empty.weights.push(weight());
  assert.equal(getBackupReminder(empty, null).reason, "never");
  const metadata = createBackupMetadata(NOW, empty);
  assert.equal(getBackupReminder(empty, metadata, "2026-08-01T00:00:00.000Z").needed, false);
  const templateChanged = structuredClone(empty);
  templateChanged.weeklyTraining[0] = "walking";
  assert.equal(getBackupReminder(templateChanged, metadata, "2026-08-01T00:00:00.000Z").reason, "templateChanges");
  assert.equal(summarizeData(templateChanged).weeklyTraining[0], "walking");
});
