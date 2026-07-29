import test from "node:test";
import assert from "node:assert/strict";

import { createEmptyData } from "../docs/model.js";
import {
  calculateRecipeNutrition,
  createFoodEntry,
  getFoodCatalog,
  sumNutrition,
} from "../docs/nutrition.js";

const FOOD = {
  ref: "custom:test",
  name: "虚构高蛋白食品",
  foodState: "packaged",
  energyKcalPer100g: 200,
  proteinGramsPer100g: 20,
  fatGramsPer100g: 5,
  carbsGramsPer100g: 10,
  source: "custom",
};

test("按实际克数计算单项和整餐营养", () => {
  const first = createFoodEntry(
    FOOD,
    150,
    "high",
    "91000000-0000-4000-8000-000000000001",
  );
  const second = createFoodEntry(
    { ...FOOD, ref: "custom:test-2", name: "虚构配菜" },
    50,
    "medium",
    "91000000-0000-4000-8000-000000000002",
  );
  assert.deepEqual(sumNutrition([first]), {
    energyKcal: 300,
    proteinGrams: 30,
    fatGrams: 7.5,
    carbsGrams: 15,
  });
  assert.deepEqual(sumNutrition([first, second]), {
    energyKcal: 400,
    proteinGrams: 40,
    fatGrams: 10,
    carbsGrams: 20,
  });
});

test("菜谱按原料总营养和成品熟重折算每百克", () => {
  const ingredient = createFoodEntry(
    FOOD,
    300,
    "high",
    "92000000-0000-4000-8000-000000000001",
  );
  assert.deepEqual(
    calculateRecipeNutrition({ ingredients: [ingredient], finishedWeightGrams: 600 }),
    {
      total: { energyKcal: 600, proteinGrams: 60, fatGrams: 15, carbsGrams: 30 },
      per100g: { energyKcal: 100, proteinGrams: 10, fatGrams: 2.5, carbsGrams: 5 },
    },
  );
});

test("食物目录包含基础食物、自定义食品和菜谱并优先收藏", () => {
  const data = createEmptyData();
  data.customFoods.push({
    id: "93000000-0000-4000-8000-000000000001",
    name: "虚构包装食品",
    foodState: "packaged",
    energyKcalPer100g: 100,
    proteinGramsPer100g: 10,
    fatGramsPer100g: 2,
    carbsGramsPer100g: 12,
    createdAt: "2026-07-29T08:00:00.000Z",
    updatedAt: "2026-07-29T08:00:00.000Z",
  });
  data.foodPreferences.favoriteRefs.push("custom:93000000-0000-4000-8000-000000000001");
  data.foodPreferences.recentRefs.push(
    "builtin:chicken-breast-cooked",
    "custom:93000000-0000-4000-8000-000000000001",
  );
  const catalog = getFoodCatalog(data);
  assert.equal(catalog[0].name, "虚构包装食品");
  assert.equal(catalog.some((food) => food.ref === "builtin:chicken-breast-cooked"), true);
});

test("克数必须为正整数", () => {
  assert.throws(
    () => createFoodEntry(FOOD, 12.5, "high", "94000000-0000-4000-8000-000000000001"),
    /整数/,
  );
});
