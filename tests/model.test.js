import test from "node:test";
import assert from "node:assert/strict";
import {
  assertValidData,
  calculateSleepMinutes,
  calculateWeightMovingAverage,
  createEmptyData,
  migrateDataV10,
  migrateDataV11,
  parseData,
  SCHEMA_VERSION,
  serializeData,
} from "../docs/model.js";
import {
  completeWorkoutSet,
  createGuidedSessionSnapshot,
  createWorkoutDraft,
} from "../docs/guided-workout.js";
import {
  food,
  healthStage,
  IDS,
  keepWorkout,
  meal,
  sleep,
  v10Meal,
  v11Workout,
  weight,
  workout,
} from "./helpers.js";

function guidedSessionSnapshot() {
  let draft = createWorkoutDraft({
    templateId: "squatAdaptation",
    date: "2026-07-31",
    id: "99999999-9999-4999-8999-999999999999",
    now: "2026-07-31T00:00:00.000Z",
  });
  for (let index = 1; index <= 3; index += 1) {
    draft = completeWorkoutSet(draft, {
      completedValue: 8,
      weightGrams: 8_000,
      now: `2026-07-31T00:0${index}:00.000Z`,
    });
  }
  return createGuidedSessionSnapshot(draft, 2, "2026-07-31T00:05:00.000Z");
}

test("schema v12 增加运动场景，同时保留个人食材、健康阶段和四类记录", () => {
  const data = createEmptyData();
  assert.equal(SCHEMA_VERSION, 12);
  assert.deepEqual(Object.keys(data), [
    "schemaVersion", "weeklyTraining", "foods", "healthStages",
    "workouts", "meals", "sleepRecords", "weights",
  ]);
  data.foods.push(food());
  data.healthStages.push(healthStage());
  data.workouts.push(workout());
  data.meals.push(meal());
  data.sleepRecords.push(sleep());
  data.weights.push(weight());
  assert.equal(assertValidData(data), true);
  assert.deepEqual(parseData(serializeData(data)), data);
});

test("schema v1 至 v11 不由 v12 解析器直接读取，未知字段仍被拒绝", () => {
  for (let version = 1; version <= 11; version += 1) {
    const data = createEmptyData();
    data.schemaVersion = version;
    assert.throws(() => assertValidData(data), /schemaVersion/);
  }
  const unknown = createEmptyData();
  unknown.hydration = [];
  assert.throws(() => assertValidData(unknown), /未知字段/);
  const unknownFoodFields = createEmptyData();
  unknownFoodFields.foods.push(food({ calories: 100 }));
  assert.throws(() => assertValidData(unknownFoodFields), /未知字段/);
});

test("有效 v11 数据迁移到 v12，并按既有记录事实映射运动场景", () => {
  const v11 = createEmptyData();
  v11.schemaVersion = 11;
  v11.workouts = [
    v11Workout(),
    v11Workout({
      id: IDS.second,
      type: "strength",
      source: "manual",
      averageHeartRateBpm: null,
      distanceMeters: null,
    }),
    v11Workout({
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      type: "strength",
      source: "manual",
      averageHeartRateBpm: null,
      distanceMeters: null,
      guidedSession: guidedSessionSnapshot(),
    }),
  ];
  const migrated = migrateDataV11(v11);
  assert.equal(migrated.schemaVersion, 12);
  assert.equal(migrated.workouts[0].scenario, "running");
  assert.equal(migrated.workouts[1].scenario, "other");
  assert.equal(migrated.workouts[2].scenario, "guided");
  assert.deepEqual(migrated.workouts.map((record) => record.keepDetails), [null, null, null]);
  assert.deepEqual(v11.workouts[0], v11Workout());
  assert.equal(assertValidData(migrated), true);
});

test("有效 v10 数据链式迁移到 v12，保留旧饮食并不猜测 Keep", () => {
  const v10 = {
    schemaVersion: 10,
    weeklyTraining: [...createEmptyData().weeklyTraining],
    workouts: [v11Workout()],
    meals: [v10Meal()],
    sleepRecords: [sleep()],
    weights: [weight()],
  };
  const migrated = migrateDataV10(v10);
  assert.equal(migrated.schemaVersion, 12);
  assert.deepEqual(migrated.foods, []);
  assert.deepEqual(migrated.healthStages, []);
  assert.deepEqual(migrated.meals[0].foodItems, []);
  assert.equal(migrated.meals[0].freeText, v10.meals[0].content);
  assert.equal(migrated.meals[0].content, v10.meals[0].content);
  assert.equal(migrated.workouts[0].scenario, "running");
  assert.equal(migrated.workouts[0].keepDetails, null);
  assert.deepEqual(v10.meals[0], v10Meal());
  assert.equal(assertValidData(migrated), true);
});

test("运动严格校验 Keep、跑步、其他和引导场景的专属字段", () => {
  const keep = createEmptyData();
  keep.workouts.push(keepWorkout());
  assert.equal(assertValidData(keep), true);

  const invalidKeep = createEmptyData();
  invalidKeep.workouts.push(keepWorkout({ keepDetails: null }));
  assert.throws(() => assertValidData(invalidKeep), /keepDetails/);

  const invalidRunning = createEmptyData();
  invalidRunning.workouts.push(workout({ type: "strength", distanceMeters: null }));
  assert.throws(() => assertValidData(invalidRunning), /跑步场景/);

  const invalid = createEmptyData();
  invalid.workouts.push(workout({ averageHeartRateBpm: 250 }));
  assert.throws(() => assertValidData(invalid), /averageHeartRateBpm/);
  const invalidDistance = createEmptyData();
  invalidDistance.workouts.push(workout({
    scenario: "other",
    type: "strength",
  }));
  assert.throws(() => assertValidData(invalidDistance), /distanceMeters/);

  const guided = createEmptyData();
  guided.workouts.push(workout({
    scenario: "guided",
    type: "strength",
    source: "manual",
    averageHeartRateBpm: null,
    distanceMeters: null,
    guidedSession: guidedSessionSnapshot(),
  }));
  assert.equal(assertValidData(guided), true);
  guided.workouts[0].guidedSession = null;
  assert.throws(() => assertValidData(guided), /引导场景/);
});

test("饮食保留原文并严格校验食材和蛋白质历史快照", () => {
  const valid = createEmptyData();
  valid.meals.push(meal({
    content: "虚构高蛋白食品 150 g，外卖配菜",
    freeText: "外卖配菜",
    foodItems: [{
      id: IDS.foodItem,
      sourceFoodId: IDS.food,
      name: "虚构高蛋白食品",
      category: "protein",
      amount: 150,
      unit: "grams",
      proteinEstimate: {
        proteinMilligrams: 30_000,
        referenceAmount: 100,
        referenceProteinMilligrams: 20_000,
        basis: "cooked",
        source: "publicReference",
        sourceNote: "虚构测试参考值",
      },
    }],
  }));
  assert.equal(assertValidData(valid), true);
  valid.meals[0].content = "   ";
  assert.throws(() => assertValidData(valid), /content/);
  valid.meals[0].content = "虚构高蛋白食品 150 g，外卖配菜";
  const tooLong = createEmptyData();
  tooLong.meals.push(meal({ content: "a".repeat(2_001) }));
  assert.throws(() => assertValidData(tooLong), /content/);
  valid.meals[0].foodItems[0].proteinEstimate.proteinMilligrams = -1;
  assert.throws(() => assertValidData(valid), /proteinMilligrams/);
});

test("个人食材的参考单位固定，健康阶段最多同时存在一个活动项", () => {
  const valid = createEmptyData();
  valid.foods.push(food());
  valid.healthStages.push(healthStage());
  assert.equal(assertValidData(valid), true);

  const mismatchedReference = createEmptyData();
  mismatchedReference.foods.push(food({ unit: "piece" }));
  assert.equal(assertValidData(mismatchedReference), true);

  const duplicateActive = createEmptyData();
  duplicateActive.healthStages.push(
    healthStage(),
    healthStage({ id: IDS.second, title: "另一个活动阶段" }),
  );
  assert.throws(() => assertValidData(duplicateActive), /活动阶段/);
});

test("睡眠与体重按自然日唯一，ID 全局唯一", () => {
  const duplicateDate = createEmptyData();
  duplicateDate.weights.push(weight(), weight({ id: IDS.second }));
  assert.throws(() => assertValidData(duplicateDate), /weights 的日期重复/);
  const duplicateId = createEmptyData();
  duplicateId.workouts.push(workout());
  duplicateId.meals.push(meal({ id: IDS.workout }));
  assert.throws(() => assertValidData(duplicateId), /ID 重复/);
});

test("跨日睡眠和七日均重按已有样本计算", () => {
  assert.equal(calculateSleepMinutes("23:00", "06:30"), 450);
  assert.throws(() => calculateSleepMinutes("23:00", "23:00"), /不能相同/);
  const result = calculateWeightMovingAverage([
    weight({ date: "2026-07-25", weightGrams: 82_000 }),
    weight({ id: IDS.second, date: "2026-07-31", weightGrams: 81_000 }),
  ], "2026-07-31");
  assert.deepEqual(result, { sampleCount: 2, averageGrams: 81_500 });
});
