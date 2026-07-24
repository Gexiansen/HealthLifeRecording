import test from "node:test";
import assert from "node:assert/strict";

import {
  addHydrationAmount,
  filterRecordItems,
  getDateContext,
  getDefaultMealType,
  getRestoreLabel,
} from "../docs/interaction.js";

test("日期语境区分今日和历史日期", () => {
  assert.deepEqual(getDateContext("2026-07-24", "2026-07-24"), {
    heading: "今日",
    hydrationLabel: "今日饮水（ml）",
  });
  assert.deepEqual(getDateContext("2026-01-08", "2026-07-24"), {
    heading: "1月8日",
    hydrationLabel: "当日饮水（ml）",
  });
});

test("餐次默认值按本地小时选择", () => {
  assert.equal(getDefaultMealType(8), "breakfast");
  assert.equal(getDefaultMealType(12), "lunch");
  assert.equal(getDefaultMealType(18), "dinner");
  assert.equal(getDefaultMealType(22), "snack");
  assert.throws(() => getDefaultMealType(24), /0～23/);
});

test("饮水快捷增加执行整数和上限校验", () => {
  assert.equal(addHydrationAmount(1_500, 250), 1_750);
  assert.equal(addHydrationAmount(0, 500), 500);
  assert.throws(() => addHydrationAmount(19_800, 500), /20000/);
});

test("记录筛选可以组合类型和月份", () => {
  const items = [
    { collectionName: "weights", record: { date: "2026-07-24" } },
    { collectionName: "meals", record: { date: "2026-07-23" } },
    { collectionName: "weights", record: { date: "2026-06-30" } },
  ];
  assert.equal(filterRecordItems(items, "weights", "2026-07").length, 1);
  assert.equal(filterRecordItems(items, "all", "2026-07").length, 2);
  assert.equal(filterRecordItems(items, "weights", "").length, 2);
});

test("恢复文案明确展示当前和备份记录数量", () => {
  assert.deepEqual(getRestoreLabel(0, 8), {
    summary: "将恢复备份中的 8 条记录。",
    action: "恢复 8 条记录",
  });
  assert.deepEqual(getRestoreLabel(20, 8), {
    summary: "当前 20 条记录将被备份中的 8 条完整替换；替换前会先下载当前数据。",
    action: "用 8 条替换当前 20 条",
  });
});
