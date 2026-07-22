import test from "node:test";
import assert from "node:assert/strict";

import { calculateTrendSummary } from "../docs/stats.js";
import { createEmptyData } from "../docs/model.js";

const createdAt = "2026-07-23T08:00:00.000Z";

function base(id, date) {
  return { id, date, createdAt, updatedAt: createdAt };
}

function sampleData() {
  const data = createEmptyData();
  data.weights.push(
    { ...base("10000000-0000-4000-8000-000000000001", "2026-07-17"), weightGrams: 70_000, bodyFatBasisPoints: null, note: "" },
    { ...base("10000000-0000-4000-8000-000000000002", "2026-07-20"), weightGrams: 69_500, bodyFatBasisPoints: null, note: "" },
    { ...base("10000000-0000-4000-8000-000000000003", "2026-07-23"), weightGrams: 69_000, bodyFatBasisPoints: null, note: "" },
  );
  data.sleepRecords.push(
    { ...base("20000000-0000-4000-8000-000000000001", "2026-07-22"), sleepTime: "23:00", wakeTime: "07:00", qualityScore: 4, awakeCount: 0, note: "" },
    { ...base("20000000-0000-4000-8000-000000000002", "2026-07-23"), sleepTime: "23:30", wakeTime: "06:30", qualityScore: 3, awakeCount: 1, note: "" },
  );
  data.workouts.push(
    { ...base("30000000-0000-4000-8000-000000000001", "2026-07-20"), type: "walking", durationMinutes: 30, intensity: 1, note: "" },
    { ...base("30000000-0000-4000-8000-000000000002", "2026-07-22"), type: "walking", durationMinutes: 20, intensity: 1, note: "" },
    { ...base("30000000-0000-4000-8000-000000000003", "2026-07-23"), type: "strength", durationMinutes: 40, intensity: 2, note: "" },
  );
  data.meals.push(
    { ...base("40000000-0000-4000-8000-000000000001", "2026-07-22"), mealType: "lunch", description: "虚构午餐", healthScore: 4, fullnessScore: 3, note: "" },
    { ...base("40000000-0000-4000-8000-000000000002", "2026-07-23"), mealType: "dinner", description: "虚构晚餐", healthScore: 5, fullnessScore: 4, note: "" },
  );
  data.hydration.push(
    { ...base("50000000-0000-4000-8000-000000000001", "2026-07-22"), milliliters: 1_500, note: "" },
    { ...base("50000000-0000-4000-8000-000000000002", "2026-07-23"), milliliters: 2_000, note: "" },
  );
  return data;
}

test("7 天趋势按自然日窗口汇总全部类型", () => {
  const summary = calculateTrendSummary(sampleData(), "2026-07-23", 7);
  assert.deepEqual(summary.period, { startDate: "2026-07-17", endDate: "2026-07-23", days: 7 });
  assert.equal(summary.weight.sampleCount, 3);
  assert.equal(summary.weight.latestGrams, 69_000);
  assert.equal(summary.weight.changeGrams, -1_000);
  assert.deepEqual(summary.weight.points.map((point) => point.movingAverageGrams), [70_000, 69_750, 69_500]);
  assert.deepEqual(summary.sleep, { sampleCount: 2, averageMinutes: 450, averageQuality: 3.5 });
  assert.deepEqual(summary.workout, { count: 3, totalMinutes: 90, byType: { walking: 50, strength: 40 } });
  assert.deepEqual(summary.meal, { count: 2, recordedDays: 2, completionPercent: 29, averageHealth: 4.5, averageFullness: 3.5 });
  assert.deepEqual(summary.hydration, { sampleCount: 2, averageMilliliters: 1_750 });
});

test("无数据时返回明确空样本而不是零值推断", () => {
  const summary = calculateTrendSummary(createEmptyData(), "2026-07-23", 30);
  assert.deepEqual(summary.weight, { sampleCount: 0, latestGrams: null, changeGrams: null, points: [] });
  assert.deepEqual(summary.sleep, { sampleCount: 0, averageMinutes: null, averageQuality: null });
  assert.equal(summary.meal.completionPercent, 0);
  assert.equal(summary.hydration.averageMilliliters, null);
});

test("窗口外数据不会进入趋势", () => {
  const summary = calculateTrendSummary(sampleData(), "2026-07-23", 3);
  assert.equal(summary.period.startDate, "2026-07-21");
  assert.equal(summary.weight.sampleCount, 1);
  assert.equal(summary.workout.count, 2);
});
