import test from "node:test";
import assert from "node:assert/strict";
import { createEmptyData } from "../docs/model.js";
import { calculateTrendComparison, calculateTrendSummary } from "../docs/stats.js";
import { IDS, meal, sleep, weight, workout } from "./helpers.js";

test("7 天趋势只汇总四类核心记录", () => {
  const data = createEmptyData();
  data.workouts.push(workout());
  data.meals.push(meal());
  data.sleepRecords.push(sleep());
  data.weights.push(weight());
  const summary = calculateTrendSummary(data, "2026-07-31", 7);
  assert.equal(summary.workout.totalMinutes, 30);
  assert.equal(summary.workout.averageHeartRateBpm, 130);
  assert.equal(summary.meal.count, 1);
  assert.equal(summary.meal.averageFullness, null);
  assert.equal(summary.sleep.averageMinutes, 450);
  assert.equal(summary.weight.latestGrams, 82_450);
  assert.deepEqual(Object.keys(summary), ["period", "weight", "sleep", "workout", "meal"]);
});

test("空窗口返回 null 样本，不以缺失日期补零", () => {
  const summary = calculateTrendSummary(createEmptyData(), "2026-07-31", 7);
  assert.equal(summary.weight.latestGrams, null);
  assert.equal(summary.sleep.averageMinutes, null);
  assert.equal(summary.workout.averageHeartRateBpm, null);
  assert.equal(summary.meal.dailyAverageNutrition, null);
});

test("趋势比较使用紧邻的等长上一周期", () => {
  const data = createEmptyData();
  data.weights.push(
    weight({ id: IDS.second, date: "2026-07-24", weightGrams: 83_000 }),
    weight({ date: "2026-07-31", weightGrams: 82_000 }),
  );
  data.workouts.push(
    workout({ id: IDS.workout, date: "2026-07-24", durationMinutes: 20 }),
    workout({ id: "66666666-6666-4666-8666-666666666666", date: "2026-07-31", durationMinutes: 30 }),
  );
  const result = calculateTrendComparison(data, "2026-07-31", 7);
  assert.equal(result.changes.weightGrams, -1_000);
  assert.equal(result.changes.workoutMinutes, 10);
});
