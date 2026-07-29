import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  createBackupMetadata,
  getBackupReminder,
  parseCompleteBackup,
  serializeCompleteBackup,
  summarizeData,
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
    counts: { workouts: 0, meals: 0, sleepRecords: 0, weights: 2, hydration: 0 },
  });
});

test("完整备份拒绝损坏 JSON、未知版本、未知字段和无效数据", () => {
  assert.throws(() => parseCompleteBackup("{broken"), /有效 JSON/);
  const valid = JSON.parse(serializeCompleteBackup(dataWithWeight(), EXPORTED_AT));
  valid.backupVersion = 3;
  assert.throws(() => parseCompleteBackup(JSON.stringify(valid)), /backupVersion/);
  valid.backupVersion = 2;
  valid.extra = true;
  assert.throws(() => parseCompleteBackup(JSON.stringify(valid)), /未知字段/);
  delete valid.extra;
  valid.data.weights[0].weightGrams = 1;
  assert.throws(() => parseCompleteBackup(JSON.stringify(valid)), /weightGrams/);
});

test("备份提醒覆盖从未备份、过期、新增较多和最新状态", () => {
  const data = dataWithWeight(11);
  assert.deepEqual(getBackupReminder(data, null, EXPORTED_AT), { needed: true, reason: "never" });
  assert.deepEqual(
    getBackupReminder(data, createBackupMetadata("2026-07-01T09:00:00.000Z", 11), EXPORTED_AT),
    { needed: true, reason: "stale" },
  );
  assert.deepEqual(
    getBackupReminder(data, createBackupMetadata("2026-07-22T09:00:00.000Z", 1), EXPORTED_AT),
    { needed: true, reason: "manyChanges" },
  );
  assert.deepEqual(
    getBackupReminder(data, createBackupMetadata("2026-07-22T09:00:00.000Z", 11), EXPORTED_AT),
    { needed: false, reason: "current" },
  );
  assert.deepEqual(getBackupReminder(createEmptyData(), null, EXPORTED_AT), { needed: false, reason: "empty" });
});

test("虚构演示备份通过应用自身校验", async () => {
  const text = await readFile(new URL("../test-data/healthlife-demo-v2.json", import.meta.url), "utf8");
  const result = parseCompleteBackup(text);
  assert.equal(result.summary.totalRecords, 8);
  assert.equal(result.summary.counts.weights, 2);
  assert.equal(summarizeData(result.backup.data).totalRecords, 8);
});
