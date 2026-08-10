import test from "node:test";
import assert from "node:assert/strict";
import { calculateHealthStageProgress } from "../docs/health-stage.js";
import { createMealFoodSnapshot } from "../docs/nutrition.js";
import { createEmptyData } from "../docs/model.js";
import { food, healthStage, IDS, meal, workout } from "./helpers.js";

test("健康阶段只按正式记录汇总蛋白质覆盖、力量和有氧次数", () => {
  const data = createEmptyData();
  const snapshot = createMealFoodSnapshot(food(), 100, IDS.foodItem);
  data.healthStages.push(healthStage());
  data.meals.push(
    meal({ foodItems: [snapshot], freeText: "", content: "虚构高蛋白食品 100 g" }),
    meal({
      id: IDS.second,
      date: "2026-07-29",
      mealType: "lunch",
      foodItems: [],
      freeText: "外食，份量不详",
      content: "外食，份量不详",
    }),
  );
  data.workouts.push(
    workout({ scenario: "other", type: "strength", source: "manual", averageHeartRateBpm: null, distanceMeters: null }),
    workout({ id: "99999999-9999-4999-8999-999999999999", date: "2026-07-30", type: "running" }),
  );
  assert.deepEqual(calculateHealthStageProgress(data, IDS.stage, "2026-07-31"), {
    period: { startDate: "2026-07-28", endDate: "2026-07-31", elapsedDays: 4 },
    protein: {
      target: { minimumMilligrams: 90_000, maximumMilligrams: 120_000 },
      mealCount: 2,
      estimatedProteinMilligrams: 20_000,
      estimatedMealCount: 1,
      partialMealCount: 0,
      unestimatedMealCount: 1,
      coveragePercent: 50,
    },
    strength: { targetSessionsPerWeek: 2, count: 1 },
    cardio: { targetSessionsPerWeek: null, count: 1 },
  });
});

test("阶段统计在开始前返回零天，结束后截断到阶段结束日期", () => {
  const data = createEmptyData();
  data.healthStages.push(healthStage());
  assert.equal(calculateHealthStageProgress(data, IDS.stage, "2026-07-20").period.elapsedDays, 0);
  assert.deepEqual(
    calculateHealthStageProgress(data, IDS.stage, "2026-09-01").period,
    { startDate: "2026-07-28", endDate: "2026-08-24", elapsedDays: 28 },
  );
  assert.throws(() => calculateHealthStageProgress(data, IDS.second, "2026-07-31"), /找不到健康阶段/);
});
