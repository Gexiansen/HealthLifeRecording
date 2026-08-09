import test from "node:test";
import assert from "node:assert/strict";
import {
  assertValidData,
  calculateSleepMinutes,
  calculateWeightMovingAverage,
  createEmptyData,
  migrateDataV10,
  parseData,
  SCHEMA_VERSION,
  serializeData,
} from "../docs/model.js";
import { food, healthStage, IDS, meal, sleep, v10Meal, weight, workout } from "./helpers.js";

test("schema v11 增加个人食材与健康阶段，同时保留四类健康记录", () => {
  const data = createEmptyData();
  assert.equal(SCHEMA_VERSION, 11);
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

test("schema v1 至 v10 不由 v11 解析器直接读取，未知字段仍被拒绝", () => {
  for (let version = 1; version <= 10; version += 1) {
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

test("有效 v10 数据迁移到 v11，保留原记录并把旧饮食标为未估算", () => {
  const v10 = {
    schemaVersion: 10,
    weeklyTraining: [...createEmptyData().weeklyTraining],
    workouts: [workout()],
    meals: [v10Meal()],
    sleepRecords: [sleep()],
    weights: [weight()],
  };
  const migrated = migrateDataV10(v10);
  assert.equal(migrated.schemaVersion, 11);
  assert.deepEqual(migrated.foods, []);
  assert.deepEqual(migrated.healthStages, []);
  assert.deepEqual(migrated.meals[0].foodItems, []);
  assert.equal(migrated.meals[0].freeText, v10.meals[0].content);
  assert.equal(migrated.meals[0].content, v10.meals[0].content);
  assert.deepEqual(v10.meals[0], v10Meal());
  assert.equal(assertValidData(migrated), true);
});

test("运动只接受可选平均心率与适用类型的距离", () => {
  const invalid = createEmptyData();
  invalid.workouts.push(workout({ averageHeartRateBpm: 250 }));
  assert.throws(() => assertValidData(invalid), /averageHeartRateBpm/);
  const invalidDistance = createEmptyData();
  invalidDistance.workouts.push(workout({ type: "strength" }));
  assert.throws(() => assertValidData(invalidDistance), /distanceMeters/);
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
