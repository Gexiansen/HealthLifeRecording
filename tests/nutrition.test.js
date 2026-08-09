import test from "node:test";
import assert from "node:assert/strict";
import {
  buildMealContent,
  calculateDailyProteinSummary,
  calculateFoodProteinMilligrams,
  calculateMealProteinSummary,
  createMealFoodSnapshot,
  foodFromMealSnapshot,
  formatProteinGrams,
} from "../docs/nutrition.js";
import { food, IDS, meal } from "./helpers.js";

test("按食材参考份量计算整数毫克并保存完整历史快照", () => {
  const source = food();
  assert.equal(calculateFoodProteinMilligrams(source, 150, "grams"), 30_000);
  const snapshot = createMealFoodSnapshot(source, 150, IDS.foodItem);
  assert.deepEqual(snapshot, {
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
  });
  assert.deepEqual(createMealFoodSnapshot(food({ proteinReference: null }), 80, IDS.foodItem), {
    id: IDS.foodItem,
    sourceFoodId: IDS.food,
    name: "虚构高蛋白食品",
    category: "protein",
    amount: 80,
    unit: "grams",
    proteinEstimate: null,
  });
});

test("参考单位不匹配时拒绝换算，不静默混用克数和个数", () => {
  assert.throws(
    () => calculateFoodProteinMilligrams(food(), 1, "piece"),
    /单位不一致/,
  );
});

test("整餐与当日汇总区分已估算、部分估算和未估算", () => {
  const estimated = createMealFoodSnapshot(food(), 100, IDS.foodItem);
  const unestimated = createMealFoodSnapshot(
    food({ id: IDS.second, name: "虚构未估算食材", proteinReference: null }),
    1,
    IDS.second,
  );
  assert.deepEqual(calculateMealProteinSummary([estimated, unestimated]), {
    status: "partial",
    estimatedProteinMilligrams: 20_000,
    estimatedItemCount: 1,
    unestimatedItemCount: 1,
  });
  assert.deepEqual(calculateMealProteinSummary([estimated], "外卖配菜"), {
    status: "partial",
    estimatedProteinMilligrams: 20_000,
    estimatedItemCount: 1,
    unestimatedItemCount: 1,
  });
  const meals = [
    meal({ foodItems: [estimated], freeText: "", content: "虚构高蛋白食品 100 g" }),
    meal({
      id: IDS.second,
      mealType: "lunch",
      foodItems: [unestimated],
      freeText: "",
      content: "虚构未估算食材 1 g",
    }),
    meal({
      id: "99999999-9999-4999-8999-999999999999",
      date: "2026-07-30",
    }),
  ];
  assert.deepEqual(calculateDailyProteinSummary(meals, "2026-07-31"), {
    mealCount: 2,
    estimatedProteinMilligrams: 20_000,
    estimatedMealCount: 1,
    partialMealCount: 0,
    unestimatedMealCount: 1,
  });
});

test("饮食原文由食材快照与自由文字稳定生成，历史快照可继续编辑", () => {
  const snapshot = createMealFoodSnapshot(food(), 150, IDS.foodItem);
  assert.equal(buildMealContent([snapshot], "外卖配菜"), "虚构高蛋白食品 150 g，外卖配菜");
  assert.equal(buildMealContent([], "  堂食，份量不详  "), "堂食，份量不详");
  assert.throws(() => buildMealContent([], "  "), /饮食内容/);
  assert.deepEqual(foodFromMealSnapshot(snapshot), {
    id: IDS.food,
    name: "虚构高蛋白食品",
    category: "protein",
    defaultAmount: 150,
    unit: "grams",
    proteinReference: {
      referenceAmount: 100,
      proteinMilligrams: 20_000,
      basis: "cooked",
      source: "publicReference",
      sourceNote: "虚构测试参考值",
    },
  });
  assert.equal(formatProteinGrams(20_050), "20.1");
});
