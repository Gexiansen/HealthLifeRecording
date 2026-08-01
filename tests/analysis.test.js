import test from "node:test";
import assert from "node:assert/strict";
import { createAnalysisExport, ANALYSIS_VERSION } from "../docs/analysis.js";
import { createEmptyData } from "../docs/model.js";
import { meal, sleep, weight, workout } from "./helpers.js";

test("分析导出按日期聚合四类数据并保留营养和运动摘要", () => {
  const data = createEmptyData();
  data.workouts.push(workout());
  data.meals.push(meal());
  data.sleepRecords.push(sleep());
  data.weights.push(weight());
  const result = createAnalysisExport(data, "2026-07-31T00:00:00.000Z");
  assert.equal(ANALYSIS_VERSION, 7);
  assert.equal(result.schemaVersion, 9);
  assert.equal(result.days.length, 1);
  assert.equal(result.days[0].workouts[0].averageHeartRateBpm, 130);
  assert.equal(result.days[0].workouts[0].paceSecondsPerKilometer, 450);
  assert.equal(result.days[0].meals[0].fullnessScore, null);
  assert.equal(result.days[0].sleep.durationMinutes, 450);
  assert.equal(result.days[0].weight.weightGrams, 82_450);
  for (const key of ["dailyActivity", "hydration", "plan"]) {
    assert.equal(Object.hasOwn(result.days[0], key), false);
  }
});
