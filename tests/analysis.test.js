import test from "node:test";
import assert from "node:assert/strict";
import { createAnalysisExport, ANALYSIS_VERSION } from "../docs/analysis.js";
import { createEmptyData } from "../docs/model.js";
import { meal, sleep, weight, workout } from "./helpers.js";

test("分析导出按日期聚合四类数据并保留文字饮食和运动摘要", () => {
  const data = createEmptyData();
  data.workouts.push(workout());
  data.meals.push(meal());
  data.sleepRecords.push(sleep());
  data.weights.push(weight());
  const result = createAnalysisExport(data, "2026-07-31T00:00:00.000Z");
  assert.equal(ANALYSIS_VERSION, 8);
  assert.equal(result.schemaVersion, 10);
  assert.equal(result.days.length, 1);
  assert.equal(result.days[0].workouts[0].averageHeartRateBpm, 130);
  assert.equal(result.days[0].workouts[0].paceSecondsPerKilometer, 450);
  assert.equal(result.days[0].meals[0].content, "鸡蛋 1 个，牛奶 250 ml");
  assert.deepEqual(Object.keys(result.days[0].meals[0]), ["mealType", "content"]);
  assert.equal(Object.hasOwn(result.days[0], "dailyNutrition"), false);
  assert.equal(result.days[0].sleep.durationMinutes, 450);
  assert.equal(result.days[0].weight.weightGrams, 82_450);
  for (const key of ["dailyActivity", "hydration", "plan"]) {
    assert.equal(Object.hasOwn(result.days[0], key), false);
  }
});
