import test from "node:test";
import assert from "node:assert/strict";
import {
  createBackupMetadata,
  getBackupReminder,
  parseCompleteBackup,
  serializeCompleteBackup,
} from "../docs/backup.js";
import { createEmptyData } from "../docs/model.js";

const EXPORTED_AT = "2026-07-23T09:00:00.000Z";

function dataWithWeight(count = 1) {
  const data = createEmptyData();
  for (let index = 0; index < count; index += 1) {
    const day = String(index + 1).padStart(2, "0");
    data.weights.push({
      id: `10000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
      date: `2026-07-${day}`,
      weightGrams: 70_000 - index * 100,
      bodyFatBasisPoints: null,
      note: "",
      createdAt: EXPORTED_AT,
      updatedAt: EXPORTED_AT,
    });
  }
  return data;
}

test("完整备份可以严格往返并生成摘要", () => {
  const data = dataWithWeight(2);
  const parsed = parseCompleteBackup(serializeCompleteBackup(data, EXPORTED_AT));
  assert.deepEqual(parsed.backup.data, data);
  assert.deepEqual(parsed.summary, {
    totalRecords: 2,
    firstDate: "2026-07-01",
    lastDate: "2026-07-02",
    counts: {
      workouts: 0,
      dailyActivities: 0,
      meals: 0,
      sleepRecords: 0,
      weights: 2,
      hydration: 0,
    },
    dailyPlanCount: 0,
    weeklyTraining: [
      "rest",
      "strengthA",
      "rest",
      "strengthB",
      "rest",
      "runWalk",
      "rest",
    ],
    workdayCounts: {},
  });
});

test("完整备份拒绝损坏 JSON、未知版本、未知字段和无效数据", () => {
  assert.throws(() => parseCompleteBackup("{broken"), /有效 JSON/);
  const valid = JSON.parse(serializeCompleteBackup(dataWithWeight(), EXPORTED_AT));
  valid.backupVersion = 4;
  assert.throws(() => parseCompleteBackup(JSON.stringify(valid)), /backupVersion/);
  valid.backupVersion = 5;
  valid.extra = true;
  assert.throws(() => parseCompleteBackup(JSON.stringify(valid)), /未知字段/);
  delete valid.extra;
  valid.data.weights[0].weightGrams = 1;
  assert.throws(() => parseCompleteBackup(JSON.stringify(valid)), /weightGrams/);
});

test("备份提醒覆盖从未备份、过期、新增较多、计划变化和最新状态", () => {
  const data = dataWithWeight(11);
  assert.deepEqual(getBackupReminder(data, null, EXPORTED_AT), { needed: true, reason: "never" });
  assert.deepEqual(
    getBackupReminder(data, createBackupMetadata("2026-07-01T09:00:00.000Z", data), EXPORTED_AT),
    { needed: true, reason: "stale" },
  );
  assert.deepEqual(
    getBackupReminder(data, createBackupMetadata(
      "2026-07-22T09:00:00.000Z",
      dataWithWeight(1),
    ), EXPORTED_AT),
    { needed: true, reason: "manyChanges" },
  );
  assert.deepEqual(
    getBackupReminder(data, createBackupMetadata("2026-07-22T09:00:00.000Z", data), EXPORTED_AT),
    { needed: false, reason: "current" },
  );
  const metadata = createBackupMetadata("2026-07-22T09:00:00.000Z", data);
  data.trainingPlan.weeklyTraining[0] = "walking";
  assert.deepEqual(
    getBackupReminder(data, metadata, EXPORTED_AT),
    { needed: true, reason: "planChanges" },
  );
  const planOnly = createEmptyData();
  planOnly.trainingPlan.weeklyTraining[0] = "walking";
  assert.deepEqual(
    getBackupReminder(planOnly, null, EXPORTED_AT),
    { needed: true, reason: "never" },
  );
  assert.deepEqual(getBackupReminder(createEmptyData(), null, EXPORTED_AT), { needed: false, reason: "empty" });
});
