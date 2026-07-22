import test from "node:test";
import assert from "node:assert/strict";

import {
  allRecordsByDate,
  deleteRecord,
  findDailyRecord,
  recordsForDate,
  saveRecord,
} from "../docs/data.js";
import { createEmptyData } from "../docs/model.js";

const CREATED_AT = "2026-07-22T08:00:00.000Z";

function weight(id, date, grams = 70_000) {
  return {
    id,
    date,
    weightGrams: grams,
    bodyFatBasisPoints: null,
    note: "",
    createdAt: CREATED_AT,
    updatedAt: CREATED_AT,
  };
}

test("saveRecord 新增和编辑记录时不修改原对象", () => {
  const original = createEmptyData();
  const record = weight("90000000-0000-4000-8000-000000000001", "2026-07-22");
  const added = saveRecord(original, "weights", record);
  assert.equal(original.weights.length, 0);
  assert.equal(added.weights.length, 1);

  const edited = saveRecord(added, "weights", {
    ...record,
    weightGrams: 69_800,
    updatedAt: "2026-07-22T09:00:00.000Z",
  });
  assert.equal(added.weights[0].weightGrams, 70_000);
  assert.equal(edited.weights[0].weightGrams, 69_800);
});

test("每日唯一记录冲突由整体校验拒绝", () => {
  let data = createEmptyData();
  data = saveRecord(
    data,
    "weights",
    weight("90000000-0000-4000-8000-000000000001", "2026-07-22"),
  );
  assert.throws(
    () =>
      saveRecord(
        data,
        "weights",
        weight("90000000-0000-4000-8000-000000000002", "2026-07-22"),
      ),
    /日期重复/,
  );
});

test("deleteRecord 返回删除内容且找不到记录时拒绝操作", () => {
  const record = weight("90000000-0000-4000-8000-000000000001", "2026-07-22");
  const data = saveRecord(createEmptyData(), "weights", record);
  const result = deleteRecord(data, "weights", record.id);
  assert.equal(result.data.weights.length, 0);
  assert.deepEqual(result.deletedRecord, record);
  assert.throws(() => deleteRecord(result.data, "weights", record.id), /找不到记录/);
});

test("日期查询和全记录排序使用稳定集合信息", () => {
  let data = createEmptyData();
  data = saveRecord(
    data,
    "weights",
    weight("90000000-0000-4000-8000-000000000001", "2026-07-21"),
  );
  data = saveRecord(data, "hydration", {
    id: "a0000000-0000-4000-8000-000000000001",
    date: "2026-07-22",
    milliliters: 2_000,
    note: "",
    createdAt: "2026-07-22T09:00:00.000Z",
    updatedAt: "2026-07-22T09:00:00.000Z",
  });

  assert.equal(findDailyRecord(data, "weights", "2026-07-21")?.weightGrams, 70_000);
  assert.equal(recordsForDate(data, "2026-07-22")[0].collectionName, "hydration");
  assert.deepEqual(
    allRecordsByDate(data).map((item) => item.record.date),
    ["2026-07-22", "2026-07-21"],
  );
});
