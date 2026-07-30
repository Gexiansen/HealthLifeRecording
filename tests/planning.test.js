import test from "node:test";
import assert from "node:assert/strict";

import { createEmptyData } from "../docs/model.js";
import {
  createDailyAdvice,
  findWorkoutPlanMatches,
  getEffectiveTraining,
  getWeeklyTrainingForDate,
  summarizePlanWindow,
} from "../docs/planning.js";

test("每周模板按周一至周日匹配训练", () => {
  const weekly = createEmptyData().trainingPlan.weeklyTraining;
  assert.equal(getWeeklyTrainingForDate(weekly, "2026-07-27"), "rest");
  assert.equal(getWeeklyTrainingForDate(weekly, "2026-07-28"), "strengthA");
  assert.equal(getWeeklyTrainingForDate(weekly, "2026-07-30"), "strengthB");
  assert.equal(getWeeklyTrainingForDate(weekly, "2026-08-01"), "runWalk");
});

test("计划趋势和匹配运动记录保持计划与事实分离", () => {
  const data = createEmptyData();
  data.workouts.push({
    id: "53000000-0000-4000-8000-000000000001",
    date: "2026-07-28",
    type: "strength",
    durationMinutes: 30,
    intensity: 2,
    source: "manual",
    activeEnergyKcal: null,
    averageHeartRateBpm: null,
    maxHeartRateBpm: null,
    distanceMeters: null,
    note: "",
    createdAt: "2026-07-28T00:00:00.000Z",
    updatedAt: "2026-07-28T00:00:00.000Z",
  });
  assert.equal(findWorkoutPlanMatches(data, "2026-07-28").length, 1);
  assert.deepEqual(
    summarizePlanWindow(data.trainingPlan, "2026-07-28", "2026-07-28"),
    { count: 0, completed: 0, shortened: 0, rescheduled: 0, rest: 0 },
  );
});

test("每日手动训练覆盖每周模板", () => {
  const plan = createEmptyData().trainingPlan;
  plan.dailyPlans.push({
    id: "52000000-0000-4000-8000-000000000001",
    date: "2026-07-28",
    workdayType: "normal",
    trainingOverride: "walking",
    status: "planned",
    rescheduledToDate: null,
    rescheduledFromDate: null,
    createdAt: "2026-07-28T00:00:00.000Z",
    updatedAt: "2026-07-28T00:00:00.000Z",
  });
  assert.equal(getEffectiveTraining(plan, "2026-07-28"), "walking");
});

test("晚加班和周末加班建议休息，2.5 小时加班允许缩短训练", () => {
  const data = createEmptyData();
  const base = {
    id: "52000000-0000-4000-8000-000000000001",
    date: "2026-07-28",
    trainingOverride: null,
    status: "planned",
    rescheduledToDate: null,
    rescheduledFromDate: null,
    createdAt: "2026-07-28T00:00:00.000Z",
    updatedAt: "2026-07-28T00:00:00.000Z",
  };

  data.trainingPlan.dailyPlans = [{ ...base, workdayType: "overtime35" }];
  assert.equal(createDailyAdvice(data.trainingPlan, base.date).recommendedTraining, "rest");

  data.trainingPlan.dailyPlans = [{ ...base, workdayType: "overtime25" }];
  assert.match(createDailyAdvice(data.trainingPlan, base.date).headline, /缩短完成/);

  data.trainingPlan.dailyPlans = [{
    ...base,
    date: "2026-08-01",
    workdayType: "weekendOvertime",
  }];
  assert.equal(createDailyAdvice(data.trainingPlan, "2026-08-01").recommendedTraining, "rest");
});
