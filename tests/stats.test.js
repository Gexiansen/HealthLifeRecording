import test from "node:test";
import assert from "node:assert/strict";

import { calculateTrendComparison, calculateTrendSummary } from "../docs/stats.js";
import { createEmptyData } from "../docs/model.js";

const createdAt = "2026-07-23T08:00:00.000Z";

function base(id, date) {
  return { id, date, createdAt, updatedAt: createdAt };
}

function meal(id, itemId, date, mealType, trackingMode, food) {
  const confidence = trackingMode === "precise" ? "high" : "medium";
  return {
    ...base(id, date),
    mealType,
    trackingMode,
    confidence,
    items: [{
      id: itemId,
      foodRef: food.ref,
      name: food.name,
      foodState: food.state,
      grams: food.grams,
      inputUnit: "grams",
      inputQuantity: food.grams,
      unitGrams: 1,
      energyKcalPer100g: food.energy,
      proteinGramsPer100g: food.protein,
      fatGramsPer100g: food.fat,
      carbsGramsPer100g: food.carbs,
      source: "builtIn",
      confidence,
    }],
    healthScore: 4,
    fullnessScore: 3,
    note: "",
  };
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
    {
      ...base("30000000-0000-4000-8000-000000000001", "2026-07-20"),
      type: "walking",
      durationMinutes: 30,
      intensity: 1,
      source: "appleWatch",
      activeEnergyKcal: 120,
      averageHeartRateBpm: 102,
      maxHeartRateBpm: 118,
      distanceMeters: 2_500,
      guidedSession: null,
      note: "",
    },
    {
      ...base("30000000-0000-4000-8000-000000000002", "2026-07-22"),
      type: "walking",
      durationMinutes: 20,
      intensity: 1,
      source: "manual",
      activeEnergyKcal: null,
      averageHeartRateBpm: null,
      maxHeartRateBpm: null,
      distanceMeters: null,
      guidedSession: null,
      note: "",
    },
    {
      ...base("30000000-0000-4000-8000-000000000003", "2026-07-23"),
      type: "strength",
      durationMinutes: 40,
      intensity: 2,
      source: "appleWatch",
      activeEnergyKcal: 180,
      averageHeartRateBpm: 110,
      maxHeartRateBpm: 138,
      distanceMeters: null,
      guidedSession: null,
      note: "",
    },
  );
  data.dailyActivities.push(
    { ...base("35000000-0000-4000-8000-000000000001", "2026-07-22"), steps: 8_000, source: "appleWatch", note: "" },
    { ...base("35000000-0000-4000-8000-000000000002", "2026-07-23"), steps: 10_000, source: "appleWatch", note: "" },
  );
  data.meals.push(
    meal(
      "40000000-0000-4000-8000-000000000001",
      "41000000-0000-4000-8000-000000000001",
      "2026-07-22",
      "lunch",
      "precise",
      { ref: "builtin:chicken", name: "虚构鸡胸", state: "cooked", grams: 150, energy: 165, protein: 31, fat: 3.6, carbs: 0 },
    ),
    {
      ...meal(
        "40000000-0000-4000-8000-000000000002",
        "41000000-0000-4000-8000-000000000002",
        "2026-07-23",
        "dinner",
        "estimated",
        { ref: "builtin:rice", name: "虚构米饭", state: "cooked", grams: 200, energy: 130, protein: 2.7, fat: 0.3, carbs: 28.2 },
      ),
      healthScore: 5,
      fullnessScore: 4,
    },
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
  assert.deepEqual(summary.workout, {
    count: 3,
    totalMinutes: 90,
    byType: { walking: 50, strength: 40 },
    appleWatchCount: 2,
    activeEnergySampleCount: 2,
    totalActiveEnergyKcal: 300,
    heartRateSampleCount: 2,
    averageHeartRateBpm: 106,
    totalDistanceMeters: 2_500,
  });
  assert.deepEqual(summary.dailyActivity, {
    sampleCount: 2,
    averageSteps: 9_000,
    totalSteps: 18_000,
  });
  assert.deepEqual(summary.meal, {
    count: 2,
    recordedDays: 2,
    completionPercent: 29,
    averageHealth: 4.5,
    averageFullness: 3.5,
    preciseCount: 1,
    estimatedCount: 1,
    totalNutrition: { energyKcal: 507.5, proteinGrams: 51.9, fatGrams: 6, carbsGrams: 56.4 },
    dailyAverageNutrition: { energyKcal: 253.8, proteinGrams: 26, fatGrams: 3, carbsGrams: 28.2 },
  });
  assert.deepEqual(summary.hydration, { sampleCount: 2, averageMilliliters: 1_750 });
});

test("无数据时返回明确空样本而不是零值推断", () => {
  const summary = calculateTrendSummary(createEmptyData(), "2026-07-23", 30);
  assert.deepEqual(summary.weight, { sampleCount: 0, latestGrams: null, changeGrams: null, points: [] });
  assert.deepEqual(summary.sleep, { sampleCount: 0, averageMinutes: null, averageQuality: null });
  assert.equal(summary.meal.completionPercent, 0);
  assert.equal(summary.hydration.averageMilliliters, null);
  assert.equal(summary.dailyActivity.averageSteps, null);
});

test("窗口外数据不会进入趋势", () => {
  const summary = calculateTrendSummary(sampleData(), "2026-07-23", 3);
  assert.equal(summary.period.startDate, "2026-07-21");
  assert.equal(summary.weight.sampleCount, 1);
  assert.equal(summary.workout.count, 2);
});

test("趋势比较使用紧邻的等长上一周期且数据不足时不推断", () => {
  const data = sampleData();
  data.weights.push(
    { ...base("10000000-0000-4000-8000-000000000004", "2026-07-16"), weightGrams: 70_500, bodyFatBasisPoints: null, note: "" },
  );
  data.sleepRecords.push(
    { ...base("20000000-0000-4000-8000-000000000003", "2026-07-16"), sleepTime: "23:00", wakeTime: "06:00", qualityScore: 3, awakeCount: 0, note: "" },
  );
  data.workouts.push(
    {
      ...base("30000000-0000-4000-8000-000000000004", "2026-07-16"),
      type: "walking",
      durationMinutes: 20,
      intensity: 1,
      source: "manual",
      activeEnergyKcal: null,
      averageHeartRateBpm: null,
      maxHeartRateBpm: null,
      distanceMeters: null,
      guidedSession: null,
      note: "",
    },
  );
  data.dailyActivities.push(
    { ...base("35000000-0000-4000-8000-000000000003", "2026-07-16"), steps: 7_000, source: "appleWatch", note: "" },
  );
  data.meals.push(
    {
      ...meal(
        "40000000-0000-4000-8000-000000000003",
        "41000000-0000-4000-8000-000000000003",
        "2026-07-16",
        "dinner",
        "precise",
        { ref: "builtin:chicken", name: "虚构鸡胸", state: "cooked", grams: 100, energy: 165, protein: 31, fat: 3.6, carbs: 0 },
      ),
      healthScore: 3,
    },
  );

  const comparison = calculateTrendComparison(data, "2026-07-23", 7);
  assert.equal(comparison.previous.period.endDate, "2026-07-16");
  assert.equal(comparison.changes.weightGrams, -1_500);
  assert.equal(comparison.changes.sleepMinutes, 30);
  assert.equal(comparison.changes.workoutMinutes, 70);
  assert.equal(comparison.changes.dailySteps, 2_000);
  assert.equal(comparison.changes.mealCompletionPoints, 15);
  assert.equal(comparison.changes.mealProteinGrams, -5);
  assert.equal(comparison.changes.hydrationMilliliters, null);
});
