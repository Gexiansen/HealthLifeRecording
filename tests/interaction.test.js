import test from "node:test";
import assert from "node:assert/strict";
import {
  calculatePaceSecondsPerKilometer,
  filterRecordItems,
  getDateContext,
  getDefaultMealType,
  getRestoreLabel,
} from "../docs/interaction.js";

test("日期语境只区分今日与历史日期标题", () => {
  assert.deepEqual(getDateContext("2026-07-31", "2026-07-31"), { heading: "今日" });
  assert.deepEqual(getDateContext("2026-07-30", "2026-07-31"), { heading: "7月30日" });
});

test("默认餐次、配速、筛选和恢复文案保持有效", () => {
  assert.equal(getDefaultMealType(7), "breakfast");
  assert.equal(getDefaultMealType(12), "lunch");
  assert.equal(calculatePaceSecondsPerKilometer(30, 5_000), 360);
  const items = [{ collectionName: "workouts", record: { date: "2026-07-31" } }];
  assert.equal(filterRecordItems(items, "workouts", "2026-07").length, 1);
  assert.throws(() => filterRecordItems(items, "plans"), /不受支持/);
  assert.match(getRestoreLabel(2, 3).summary, /完整替换/);
});
