import test from "node:test";
import assert from "node:assert/strict";

import {
  allRecordsByDate,
  deleteRecord,
  findDailyRecord,
  recordsForDate,
  saveCustomFood,
  saveDailyPlan,
  saveRecipe,
  saveRecord,
  updateEggGramsPerPiece,
  updateFoodPreferences,
  updateWeeklyTraining,
} from "../docs/data.js";
import { createEmptyData } from "../docs/model.js";

const CREATED_AT = "2026-07-22T08:00:00.000Z";

function weight(id, date, grams = 70_000) {
  return {
    id,
    date,
    weightGrams: grams,
    bodyFatBasisPoints: null,
    note: "",
    createdAt: CREATED_AT,
    updatedAt: CREATED_AT,
  };
}

test("saveRecord 新增和编辑记录时不修改原对象", () => {
  const original = createEmptyData();
  const record = weight("90000000-0000-4000-8000-000000000001", "2026-07-22");
  const added = saveRecord(original, "weights", record);
  assert.equal(original.weights.length, 0);
  assert.equal(added.weights.length, 1);

  const edited = saveRecord(added, "weights", {
    ...record,
    weightGrams: 69_800,
    updatedAt: "2026-07-22T09:00:00.000Z",
  });
  assert.equal(added.weights[0].weightGrams, 70_000);
  assert.equal(edited.weights[0].weightGrams, 69_800);
});

test("每日唯一记录冲突由整体校验拒绝", () => {
  let data = createEmptyData();
  data = saveRecord(
    data,
    "weights",
    weight("90000000-0000-4000-8000-000000000001", "2026-07-22"),
  );
  assert.throws(
    () =>
      saveRecord(
        data,
        "weights",
        weight("90000000-0000-4000-8000-000000000002", "2026-07-22"),
      ),
    /日期重复/,
  );
});

test("deleteRecord 返回删除内容且找不到记录时拒绝操作", () => {
  const record = weight("90000000-0000-4000-8000-000000000001", "2026-07-22");
  const data = saveRecord(createEmptyData(), "weights", record);
  const result = deleteRecord(data, "weights", record.id);
  assert.equal(result.data.weights.length, 0);
  assert.deepEqual(result.deletedRecord, record);
  assert.throws(() => deleteRecord(result.data, "weights", record.id), /找不到记录/);
});

test("日期查询和全记录排序使用稳定集合信息", () => {
  let data = createEmptyData();
  data = saveRecord(
    data,
    "weights",
    weight("90000000-0000-4000-8000-000000000001", "2026-07-21"),
  );
  data = saveRecord(data, "hydration", {
    id: "a0000000-0000-4000-8000-000000000001",
    date: "2026-07-22",
    milliliters: 2_000,
    note: "",
    createdAt: "2026-07-22T09:00:00.000Z",
    updatedAt: "2026-07-22T09:00:00.000Z",
  });

  assert.equal(findDailyRecord(data, "weights", "2026-07-21")?.weightGrams, 70_000);
  assert.equal(recordsForDate(data, "2026-07-22")[0].collectionName, "hydration");
  assert.deepEqual(
    allRecordsByDate(data).map((item) => item.record.date),
    ["2026-07-22", "2026-07-21"],
  );
});

test("自定义食品和菜谱保存为不可变数据", () => {
  const original = createEmptyData();
  const food = {
    id: "b0000000-0000-4000-8000-000000000001",
    name: "自制鸡肉",
    foodState: "cooked",
    energyKcalPer100g: 165,
    proteinGramsPer100g: 31,
    fatGramsPer100g: 3.6,
    carbsGramsPer100g: 0,
    createdAt: CREATED_AT,
    updatedAt: CREATED_AT,
  };
  const withFood = saveCustomFood(original, food);
  assert.equal(original.customFoods.length, 0);
  assert.equal(withFood.customFoods[0].name, "自制鸡肉");

  const recipe = {
    id: "c0000000-0000-4000-8000-000000000001",
    name: "鸡肉饭",
    finishedWeightGrams: 300,
    ingredients: [{
      id: "d0000000-0000-4000-8000-000000000001",
      foodRef: `custom:${food.id}`,
      name: food.name,
      foodState: food.foodState,
      grams: 100,
      inputUnit: "grams",
      inputQuantity: 100,
      unitGrams: 1,
      energyKcalPer100g: food.energyKcalPer100g,
      proteinGramsPer100g: food.proteinGramsPer100g,
      fatGramsPer100g: food.fatGramsPer100g,
      carbsGramsPer100g: food.carbsGramsPer100g,
      source: "custom",
      confidence: "high",
    }],
    createdAt: CREATED_AT,
    updatedAt: CREATED_AT,
  };
  const withRecipe = saveRecipe(withFood, recipe);
  assert.equal(withFood.recipes.length, 0);
  assert.equal(withRecipe.recipes[0].finishedWeightGrams, 300);
});

test("食物偏好更新最近使用顺序并维护收藏", () => {
  const original = createEmptyData();
  const first = updateFoodPreferences(original, "builtin:egg-boiled", true);
  const second = updateFoodPreferences(first, "builtin:milk-whole");
  const third = updateFoodPreferences(second, "builtin:egg-boiled", false);

  assert.deepEqual(original.foodPreferences.recentRefs, []);
  assert.deepEqual(third.foodPreferences.recentRefs, [
    "builtin:egg-boiled",
    "builtin:milk-whole",
  ]);
  assert.deepEqual(third.foodPreferences.favoriteRefs, []);
});

test("鸡蛋单个克数设置以不可变方式保存", () => {
  const original = createEmptyData();
  const updated = updateEggGramsPerPiece(original, 55);
  assert.equal(original.settings.eggGramsPerPiece, 50);
  assert.equal(updated.settings.eggGramsPerPiece, 55);
  assert.throws(() => updateEggGramsPerPiece(updated, 101), /eggGramsPerPiece/);
});

test("每周模板和每日计划以不可变方式保存", () => {
  const original = createEmptyData();
  const weekly = [...original.trainingPlan.weeklyTraining];
  weekly[0] = "walking";
  const withWeekly = updateWeeklyTraining(original, weekly);
  assert.equal(original.trainingPlan.weeklyTraining[0], "rest");
  assert.equal(withWeekly.trainingPlan.weeklyTraining[0], "walking");

  const plan = {
    id: "e0000000-0000-4000-8000-000000000001",
    date: "2026-07-28",
    workdayType: "normal",
    trainingOverride: null,
    status: "planned",
    rescheduledToDate: null,
    createdAt: CREATED_AT,
    updatedAt: CREATED_AT,
  };
  const withPlan = saveDailyPlan(withWeekly, plan);
  assert.equal(withWeekly.trainingPlan.dailyPlans.length, 0);
  assert.equal(withPlan.trainingPlan.dailyPlans[0].workdayType, "normal");

  const edited = saveDailyPlan(withPlan, {
    ...plan,
    status: "completed",
    updatedAt: "2026-07-22T09:00:00.000Z",
  });
  assert.equal(edited.trainingPlan.dailyPlans.length, 1);
  assert.equal(edited.trainingPlan.dailyPlans[0].status, "completed");
});
