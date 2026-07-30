import test from "node:test";
import assert from "node:assert/strict";

import { createAnalysisExport } from "../docs/analysis.js";
import { createEmptyData } from "../docs/model.js";

test("分析导出按日期汇总餐食营养并保留可信度", () => {
  const data = createEmptyData();
  data.meals.push({
    id: "95000000-0000-4000-8000-000000000001",
    date: "2026-07-29",
    mealType: "lunch",
    trackingMode: "precise",
    confidence: "high",
    items: [{
      id: "95100000-0000-4000-8000-000000000001",
      foodRef: "builtin:chicken-breast-cooked",
      name: "鸡胸肉（熟）",
      foodState: "cooked",
      grams: 200,
      inputUnit: "grams",
      inputQuantity: 200,
      unitGrams: 1,
      energyKcalPer100g: 165,
      proteinGramsPer100g: 31,
      fatGramsPer100g: 3.6,
      carbsGramsPer100g: 0,
      source: "builtIn",
      confidence: "high",
    }],
    healthScore: 4,
    fullnessScore: 3,
    note: "",
    createdAt: "2026-07-29T08:00:00.000Z",
    updatedAt: "2026-07-29T08:00:00.000Z",
  });
  data.dailyActivities.push({
    id: "95200000-0000-4000-8000-000000000001",
    date: "2026-07-29",
    steps: 8_500,
    source: "appleWatch",
    note: "",
    createdAt: "2026-07-29T08:00:00.000Z",
    updatedAt: "2026-07-29T08:00:00.000Z",
  });
  data.workouts.push({
    id: "95300000-0000-4000-8000-000000000001",
    date: "2026-07-29",
    type: "running",
    durationMinutes: 30,
    intensity: 2,
    source: "appleWatch",
    activeEnergyKcal: 260,
    averageHeartRateBpm: 145,
    maxHeartRateBpm: 168,
    distanceMeters: 5_000,
    guidedSession: null,
    note: "",
    createdAt: "2026-07-29T08:00:00.000Z",
    updatedAt: "2026-07-29T08:00:00.000Z",
  });
  data.trainingPlan.dailyPlans.push({
    id: "95400000-0000-4000-8000-000000000001",
    date: "2026-07-29",
    workdayType: "overtime35",
    trainingOverride: "rest",
    status: "rest",
    rescheduledToDate: null,
    rescheduledFromDate: null,
    createdAt: "2026-07-29T08:00:00.000Z",
    updatedAt: "2026-07-29T08:00:00.000Z",
  });
  const result = createAnalysisExport(data, "2026-07-29T09:00:00.000Z");
  assert.equal(result.analysisVersion, 4);
  assert.equal(result.schemaVersion, 6);
  assert.deepEqual(result.dateRange, {
    firstDate: "2026-07-29",
    lastDate: "2026-07-29",
    daysWithRecords: 1,
  });
  assert.deepEqual(result.days[0].dailyNutrition, {
    energyKcal: 330,
    proteinGrams: 62,
    fatGrams: 7.2,
    carbsGrams: 0,
  });
  assert.equal(result.days[0].meals[0].confidence, "high");
  assert.equal(result.days[0].dailyActivity.steps, 8_500);
  assert.equal(result.days[0].workouts[0].paceSecondsPerKilometer, 360);
  assert.equal(result.days[0].workouts[0].guidedSession, null);
  assert.equal(result.days[0].meals[0].items[0].inputUnit, "grams");
  assert.deepEqual(result.days[0].plan, {
    workdayType: "overtime35",
    plannedTraining: "rest",
    status: "rest",
    rescheduledToDate: null,
    rescheduledFromDate: null,
  });
});
