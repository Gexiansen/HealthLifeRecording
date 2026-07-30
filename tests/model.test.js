import test from "node:test";
import assert from "node:assert/strict";

import {
  assertValidData,
  calculateSleepMinutes,
  calculateWeightMovingAverage,
  createEmptyData,
} from "../docs/model.js";

const CREATED_AT = "2026-07-22T08:00:00.000Z";

function baseRecord(id, date) {
  return {
    id,
    date,
    createdAt: CREATED_AT,
    updatedAt: CREATED_AT,
  };
}

function validData() {
  const data = createEmptyData();
  data.workouts.push({
    ...baseRecord("10000000-0000-4000-8000-000000000001", "2026-07-20"),
    type: "strength",
    durationMinutes: 45,
    intensity: 2,
    source: "appleWatch",
    activeEnergyKcal: 180,
    averageHeartRateBpm: 108,
    maxHeartRateBpm: 136,
    distanceMeters: null,
    note: "虚构训练",
  });
  data.meals.push({
    ...baseRecord("20000000-0000-4000-8000-000000000001", "2026-07-20"),
    mealType: "lunch",
    trackingMode: "precise",
    confidence: "high",
    items: [{
      id: "21000000-0000-4000-8000-000000000001",
      foodRef: "builtin:chicken-breast-cooked",
      name: "鸡胸肉（熟）",
      foodState: "cooked",
      grams: 150,
      inputUnit: "grams",
      inputQuantity: 150,
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
  });
  data.sleepRecords.push({
    ...baseRecord("30000000-0000-4000-8000-000000000001", "2026-07-21"),
    sleepTime: "23:30",
    wakeTime: "07:15",
    qualityScore: 4,
    awakeCount: 1,
    note: "",
  });
  data.weights.push({
    ...baseRecord("40000000-0000-4000-8000-000000000001", "2026-07-21"),
    weightGrams: 70_200,
    bodyFatBasisPoints: 1_850,
    note: "",
  });
  data.hydration.push({
    ...baseRecord("50000000-0000-4000-8000-000000000001", "2026-07-21"),
    milliliters: 1_800,
    note: "",
  });
  data.dailyActivities.push({
    ...baseRecord("51000000-0000-4000-8000-000000000001", "2026-07-21"),
    steps: 8_000,
    source: "appleWatch",
    note: "",
  });
  return data;
}

test("空数据和完整 schema v5 数据通过校验", () => {
  assert.equal(assertValidData(createEmptyData()), true);
  assert.equal(assertValidData(validData()), true);
});

test("拒绝未知版本、未知字段和不存在的日期", () => {
  const unknownVersion = validData();
  unknownVersion.schemaVersion = 4;
  assert.throws(() => assertValidData(unknownVersion), /schemaVersion/);

  const unknownField = validData();
  unknownField.extra = true;
  assert.throws(() => assertValidData(unknownField), /未知字段/);

  const invalidDate = validData();
  invalidDate.workouts[0].date = "2026-02-29";
  assert.throws(() => assertValidData(invalidDate), /有效日期/);
});

test("运动、饮食和设置字段执行严格范围校验", () => {
  const invalidWorkout = validData();
  invalidWorkout.workouts[0].durationMinutes = 0;
  assert.throws(() => assertValidData(invalidWorkout), /durationMinutes/);

  const invalidMeal = validData();
  invalidMeal.meals[0].healthScore = 6;
  assert.throws(() => assertValidData(invalidMeal), /healthScore/);

  const invalidNutrition = validData();
  invalidNutrition.meals[0].items[0].proteinGramsPer100g = 31.25;
  assert.throws(() => assertValidData(invalidNutrition), /一位小数/);

  const invalidMode = validData();
  invalidMode.meals[0].confidence = "low";
  assert.throws(() => assertValidData(invalidMode), /精确模式/);

  const invalidSettings = validData();
  invalidSettings.settings.goalWeightGrams = 70.5;
  assert.throws(() => assertValidData(invalidSettings), /goalWeightGrams/);

  const invalidHeartRate = validData();
  invalidHeartRate.workouts[0].maxHeartRateBpm = 100;
  assert.throws(() => assertValidData(invalidHeartRate), /不能低于平均心率/);

  const invalidStrengthDistance = validData();
  invalidStrengthDistance.workouts[0].distanceMeters = 1_000;
  assert.throws(() => assertValidData(invalidStrengthDistance), /只适用于/);

  const invalidServing = validData();
  invalidServing.meals[0].items[0].grams = 149;
  assert.throws(() => assertValidData(invalidServing), /换算不一致/);

  const invalidWeeklyPlan = validData();
  invalidWeeklyPlan.trainingPlan.weeklyTraining[0] = "hardRun";
  assert.throws(() => assertValidData(invalidWeeklyPlan), /weeklyTraining/);
});

test("每日计划严格校验状态、改期日期和日期唯一性", () => {
  const data = validData();
  const plan = {
    ...baseRecord("52000000-0000-4000-8000-000000000001", "2026-07-21"),
    workdayType: "overtime35",
    trainingOverride: null,
    status: "rescheduled",
    rescheduledToDate: "2026-07-22",
    rescheduledFromDate: null,
  };
  data.trainingPlan.dailyPlans.push(plan, {
    ...baseRecord("52000000-0000-4000-8000-000000000002", "2026-07-22"),
    workdayType: "normal",
    trainingOverride: "strengthA",
    status: "planned",
    rescheduledToDate: null,
    rescheduledFromDate: "2026-07-21",
  });
  assert.equal(assertValidData(data), true);

  const invalidStatus = structuredClone(data);
  invalidStatus.trainingPlan.dailyPlans[0].status = "skipped";
  assert.throws(() => assertValidData(invalidStatus), /status/);

  const invalidReschedule = structuredClone(data);
  invalidReschedule.trainingPlan.dailyPlans[0].rescheduledToDate = "2026-07-21";
  assert.throws(() => assertValidData(invalidReschedule), /不能与原日期相同/);

  const duplicateDate = structuredClone(data);
  duplicateDate.trainingPlan.dailyPlans.push({
    ...plan,
    id: "52000000-0000-4000-8000-000000000003",
  });
  assert.throws(() => assertValidData(duplicateDate), /dailyPlans 的日期重复/);

  const orphanedTarget = structuredClone(data);
  orphanedTarget.trainingPlan.dailyPlans[1].rescheduledFromDate = null;
  assert.throws(() => assertValidData(orphanedTarget), /缺少来源关联/);
});

test("跨日和同日睡眠时长计算正确，并拒绝相同时间", () => {
  assert.equal(calculateSleepMinutes("23:30", "07:30"), 480);
  assert.equal(calculateSleepMinutes("13:00", "14:15"), 75);
  assert.throws(() => calculateSleepMinutes("08:00", "08:00"), /不能相同/);
  assert.throws(() => calculateSleepMinutes("24:00", "08:00"), /HH:mm/);
});

test("睡眠、体重、饮水和每日活动分别按日期唯一", () => {
  const duplicateWeight = validData();
  duplicateWeight.weights.push({
    ...duplicateWeight.weights[0],
    id: "40000000-0000-4000-8000-000000000002",
  });
  assert.throws(() => assertValidData(duplicateWeight), /weights 的日期重复/);

  const duplicateSleep = validData();
  duplicateSleep.sleepRecords.push({
    ...duplicateSleep.sleepRecords[0],
    id: "30000000-0000-4000-8000-000000000002",
  });
  assert.throws(() => assertValidData(duplicateSleep), /sleepRecords 的日期重复/);

  const duplicateHydration = validData();
  duplicateHydration.hydration.push({
    ...duplicateHydration.hydration[0],
    id: "50000000-0000-4000-8000-000000000002",
  });
  assert.throws(() => assertValidData(duplicateHydration), /hydration 的日期重复/);

  const duplicateActivity = validData();
  duplicateActivity.dailyActivities.push({
    ...duplicateActivity.dailyActivities[0],
    id: "51000000-0000-4000-8000-000000000002",
  });
  assert.throws(() => assertValidData(duplicateActivity), /dailyActivities 的日期重复/);
});

test("所有记录集合共享全局 ID 唯一性", () => {
  const data = validData();
  data.meals[0].id = data.workouts[0].id;
  assert.throws(() => assertValidData(data), /记录 ID 重复/);
});

test("7 日均重只使用日期窗口内已有样本且不补零", () => {
  const weights = [
    {
      ...baseRecord("60000000-0000-4000-8000-000000000001", "2026-07-14"),
      weightGrams: 72_000,
      bodyFatBasisPoints: null,
      note: "",
    },
    {
      ...baseRecord("60000000-0000-4000-8000-000000000002", "2026-07-16"),
      weightGrams: 70_000,
      bodyFatBasisPoints: null,
      note: "",
    },
    {
      ...baseRecord("60000000-0000-4000-8000-000000000003", "2026-07-22"),
      weightGrams: 71_001,
      bodyFatBasisPoints: null,
      note: "",
    },
  ];

  assert.deepEqual(calculateWeightMovingAverage(weights, "2026-07-22"), {
    sampleCount: 2,
    averageGrams: 70_501,
  });
  assert.deepEqual(calculateWeightMovingAverage([], "2026-07-22"), {
    sampleCount: 0,
    averageGrams: null,
  });
});

test("时间戳必须规范且更新时间不能早于创建时间", () => {
  const nonCanonical = validData();
  nonCanonical.workouts[0].createdAt = "2026-07-22T16:00:00+08:00";
  assert.throws(() => assertValidData(nonCanonical), /标准 UTC/);

  const reversed = validData();
  reversed.workouts[0].updatedAt = "2026-07-22T07:59:59.000Z";
  assert.throws(() => assertValidData(reversed), /不能早于/);
});
