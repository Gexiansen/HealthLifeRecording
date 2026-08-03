import test from "node:test";
import assert from "node:assert/strict";
import {
  assertValidData,
  calculateSleepMinutes,
  calculateWeightMovingAverage,
  createEmptyData,
  parseData,
  SCHEMA_VERSION,
  serializeData,
} from "../docs/model.js";
import { IDS, meal, sleep, weight, workout } from "./helpers.js";

test("schema v10 仅包含四类健康记录、文字饮食与可执行训练模板", () => {
  const data = createEmptyData();
  assert.equal(SCHEMA_VERSION, 10);
  assert.deepEqual(Object.keys(data), [
    "schemaVersion", "weeklyTraining", "workouts", "meals", "sleepRecords", "weights",
  ]);
  data.workouts.push(workout());
  data.meals.push(meal());
  data.sleepRecords.push(sleep());
  data.weights.push(weight());
  assert.equal(assertValidData(data), true);
  assert.deepEqual(parseData(serializeData(data)), data);
});

test("schema v1 至 v9 不直接读取，未知字段仍被拒绝", () => {
  for (let version = 1; version <= 9; version += 1) {
    const data = createEmptyData();
    data.schemaVersion = version;
    assert.throws(() => assertValidData(data), /schemaVersion/);
  }
  const unknown = createEmptyData();
  unknown.hydration = [];
  assert.throws(() => assertValidData(unknown), /未知字段/);
  const removedFoodFields = createEmptyData();
  removedFoodFields.customFoods = [];
  assert.throws(() => assertValidData(removedFoodFields), /未知字段/);
});

test("运动只接受可选平均心率与适用类型的距离", () => {
  const invalid = createEmptyData();
  invalid.workouts.push(workout({ averageHeartRateBpm: 250 }));
  assert.throws(() => assertValidData(invalid), /averageHeartRateBpm/);
  const invalidDistance = createEmptyData();
  invalidDistance.workouts.push(workout({ type: "strength" }));
  assert.throws(() => assertValidData(invalidDistance), /distanceMeters/);
});

test("饮食只保存非空文字内容，并拒绝旧营养字段", () => {
  const valid = createEmptyData();
  valid.meals.push(meal({ content: "外卖牛肉饭，吃了一半" }));
  assert.equal(assertValidData(valid), true);
  valid.meals[0].content = "   ";
  assert.throws(() => assertValidData(valid), /content/);
  const tooLong = createEmptyData();
  tooLong.meals.push(meal({ content: "a".repeat(2_001) }));
  assert.throws(() => assertValidData(tooLong), /content/);
  const legacy = createEmptyData();
  legacy.meals.push(meal({ trackingMode: "estimated" }));
  assert.throws(() => assertValidData(legacy), /字段不完整/);
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
