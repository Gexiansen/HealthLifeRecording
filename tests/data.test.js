import test from "node:test";
import assert from "node:assert/strict";
import {
  allRecordsByDate,
  deleteRecord,
  findDailyRecord,
  deleteFood,
  getFoodProteinHistoryImpact,
  reorderFoods,
  recordsForDate,
  saveFood,
  saveFoodWithProteinHistory,
  saveRecord,
  updateWeeklyTraining,
} from "../docs/data.js";
import { createEmptyData } from "../docs/model.js";
import { createMealFoodSnapshot } from "../docs/nutrition.js";
import { food, IDS, meal, sleep, weight, workout } from "./helpers.js";

test("四类记录可新增、编辑、按日期汇总与删除且不修改原对象", () => {
  const original = createEmptyData();
  let data = saveRecord(original, "workouts", workout());
  data = saveRecord(data, "meals", meal());
  data = saveRecord(data, "sleepRecords", sleep());
  data = saveRecord(data, "weights", weight());
  assert.equal(original.workouts.length, 0);
  assert.equal(recordsForDate(data, "2026-07-31").length, 4);
  data = saveRecord(data, "workouts", workout({ durationMinutes: 45 }));
  assert.equal(data.workouts[0].durationMinutes, 45);
  const result = deleteRecord(data, "meals", IDS.meal);
  assert.equal(result.data.meals.length, 0);
});

test("个人食材可新增、编辑、排序和移除且不修改原对象", () => {
  const original = createEmptyData();
  let data = saveFood(original, food());
  data = saveFood(data, food({ id: IDS.second, name: "虚构第二食材" }));
  assert.equal(original.foods.length, 0);
  data = saveFood(data, food({ name: "虚构已编辑食材" }));
  assert.equal(data.foods[0].name, "虚构已编辑食材");
  data = reorderFoods(data, [IDS.second, IDS.food]);
  assert.deepEqual(data.foods.map((item) => item.id), [IDS.second, IDS.food]);
  const deleted = deleteFood(data, IDS.second);
  assert.equal(deleted.data.foods.length, 1);
  assert.equal(deleted.deletedFood.id, IDS.second);
});

test("移除常用食材不会删除或改写已有饮食快照", () => {
  const sourceFood = food();
  const data = createEmptyData();
  data.foods.push(sourceFood);
  data.meals.push(meal({
    content: "虚构高蛋白食品 100 g",
    freeText: "",
    foodItems: [createMealFoodSnapshot(sourceFood, 100, IDS.foodItem)],
  }));
  const result = deleteFood(data, sourceFood.id);
  assert.equal(result.data.foods.length, 0);
  assert.equal(result.data.meals[0].foodItems[0].proteinEstimate.proteinMilligrams, 20_000);
  assert.equal(data.foods.length, 1);
});

test("修正常用食材参考值时预览影响，并只重算兼容历史快照的蛋白质字段", () => {
  const sourceFood = food();
  const secondItemId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const data = createEmptyData();
  data.foods.push(sourceFood);
  data.meals.push(
    meal({
      content: "虚构高蛋白食品 100 g",
      freeText: "",
      foodItems: [createMealFoodSnapshot(sourceFood, 100, IDS.foodItem)],
    }),
    meal({
      id: IDS.second,
      date: "2026-08-02",
      mealType: "lunch",
      content: "虚构高蛋白食品 150 g，虚构配菜",
      freeText: "虚构配菜",
      foodItems: [createMealFoodSnapshot(sourceFood, 150, secondItemId)],
    }),
  );
  const correctedFood = food({
    proteinReference: {
      ...sourceFood.proteinReference,
      proteinMilligrams: 25_000,
      sourceNote: "修正后的虚构参考值",
    },
    updatedAt: "2026-08-10T01:00:00.000Z",
  });

  assert.deepEqual(getFoodProteinHistoryImpact(data, correctedFood), {
    historyMealCount: 2,
    eligibleMealCount: 2,
    skippedMealCount: 0,
    historyStartDate: "2026-07-31",
    historyEndDate: "2026-08-02",
    syncStartDate: "2026-07-31",
    syncEndDate: "2026-08-02",
    previousEstimatedMealCount: 2,
    previousProteinMilligrams: 50_000,
    nextEstimatedMealCount: 2,
    nextProteinMilligrams: 62_500,
    syncAllowed: true,
    blockedReason: null,
  });

  const result = saveFoodWithProteinHistory(data, correctedFood);
  assert.equal(result.data.foods[0].proteinReference.proteinMilligrams, 25_000);
  assert.equal(result.data.meals[0].foodItems[0].proteinEstimate.proteinMilligrams, 25_000);
  assert.equal(result.data.meals[1].foodItems[0].proteinEstimate.proteinMilligrams, 37_500);
  assert.equal(result.data.meals[1].foodItems[0].proteinEstimate.referenceProteinMilligrams, 25_000);
  assert.equal(result.data.meals[1].foodItems[0].proteinEstimate.sourceNote, "修正后的虚构参考值");
  assert.equal(result.data.meals[1].foodItems[0].name, "虚构高蛋白食品");
  assert.equal(result.data.meals[1].foodItems[0].amount, 150);
  assert.equal(result.data.meals[1].content, "虚构高蛋白食品 150 g，虚构配菜");
  assert.equal(result.data.meals[1].freeText, "虚构配菜");
  assert.equal(result.data.meals[1].updatedAt, correctedFood.updatedAt);
  assert.equal(data.meals[0].foodItems[0].proteinEstimate.proteinMilligrams, 20_000);
});

test("单位或生熟口径变化时禁止批量修正，普通食材信息变化不触发历史提示", () => {
  const sourceFood = food();
  const data = createEmptyData();
  data.foods.push(sourceFood);
  data.meals.push(meal({
    content: "虚构高蛋白食品 100 g",
    freeText: "",
    foodItems: [createMealFoodSnapshot(sourceFood, 100, IDS.foodItem)],
  }));

  const basisChanged = food({
    proteinReference: { ...sourceFood.proteinReference, basis: "raw" },
  });
  const basisImpact = getFoodProteinHistoryImpact(data, basisChanged);
  assert.equal(basisImpact.syncAllowed, false);
  assert.equal(basisImpact.blockedReason, "basisChanged");
  assert.throws(() => saveFoodWithProteinHistory(data, basisChanged), /不允许批量修正/);

  const unitChanged = food({ unit: "piece" });
  const unitImpact = getFoodProteinHistoryImpact(data, unitChanged);
  assert.equal(unitImpact.syncAllowed, false);
  assert.equal(unitImpact.blockedReason, "unitChanged");
  assert.equal(getFoodProteinHistoryImpact(data, food({ name: "虚构食材新名称" })), null);
});

test("部分历史快照口径不兼容时只修正可预览部分", () => {
  const sourceFood = food();
  const incompatibleSnapshot = createMealFoodSnapshot(
    sourceFood,
    100,
    "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  );
  incompatibleSnapshot.proteinEstimate.basis = "raw";
  const data = createEmptyData();
  data.foods.push(sourceFood);
  data.meals.push(
    meal({
      content: "虚构高蛋白食品 100 g",
      freeText: "",
      foodItems: [createMealFoodSnapshot(sourceFood, 100, IDS.foodItem)],
    }),
    meal({
      id: IDS.second,
      date: "2026-08-02",
      mealType: "lunch",
      content: "虚构高蛋白食品 100 g",
      freeText: "",
      foodItems: [incompatibleSnapshot],
    }),
  );
  const correctedFood = food({
    proteinReference: { ...sourceFood.proteinReference, proteinMilligrams: 25_000 },
    updatedAt: "2026-08-10T02:00:00.000Z",
  });

  const impact = getFoodProteinHistoryImpact(data, correctedFood);
  assert.equal(impact.syncAllowed, true);
  assert.equal(impact.eligibleMealCount, 1);
  assert.equal(impact.skippedMealCount, 1);
  const result = saveFoodWithProteinHistory(data, correctedFood);
  assert.equal(result.data.meals[0].foodItems[0].proteinEstimate.proteinMilligrams, 25_000);
  assert.equal(result.data.meals[0].updatedAt, correctedFood.updatedAt);
  assert.equal(result.data.meals[1].foodItems[0].proteinEstimate.proteinMilligrams, 20_000);
  assert.equal(result.data.meals[1].foodItems[0].proteinEstimate.basis, "raw");
  assert.equal(result.data.meals[1].updatedAt, data.meals[1].updatedAt);
});

test("睡眠和体重支持每日唯一查询，其他集合拒绝该查询", () => {
  const data = createEmptyData();
  data.sleepRecords.push(sleep());
  assert.equal(findDailyRecord(data, "sleepRecords", "2026-07-31").id, IDS.sleep);
  assert.throws(() => findDailyRecord(data, "workouts", "2026-07-31"), /不支持/);
});

test("记录列表按日期和创建时间倒序，每周模板直接更新根字段", () => {
  const data = createEmptyData();
  data.workouts.push(workout({ date: "2026-07-30" }));
  data.weights.push(weight());
  assert.equal(allRecordsByDate(data)[0].collectionName, "weights");
  const weekly = [...data.weeklyTraining];
  weekly[0] = "runWalk";
  const next = updateWeeklyTraining(data, weekly);
  assert.equal(next.weeklyTraining[0], "runWalk");
  assert.equal(data.weeklyTraining[0], "rest");
});
