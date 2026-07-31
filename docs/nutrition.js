import { assertValidData } from "./model.js?v=17";

// Generic reference values are adapted from USDA FoodData Central per 100 g entries.
// They remain estimates because cultivar, brand, cut and cooking water can change the result.
export const BUILT_IN_FOODS = Object.freeze([
  food("builtin:egg-boiled", "鸡蛋（水煮）", "cooked", 155, 12.6, 10.6, 1.1, 50),
  food("builtin:chicken-breast-raw", "鸡胸肉（生）", "raw", 120, 22.5, 2.6, 0),
  food("builtin:chicken-breast-cooked", "鸡胸肉（熟）", "cooked", 165, 31, 3.6, 0),
  food("builtin:beef-lean-cooked", "瘦牛肉（熟）", "cooked", 250, 26, 15, 0),
  food("builtin:salmon-cooked", "三文鱼（熟）", "cooked", 206, 22.1, 12.4, 0),
  food("builtin:tofu-firm", "北豆腐", "prepared", 144, 17.3, 8.7, 2.8),
  food("builtin:milk-whole", "全脂牛奶", "packaged", 61, 3.2, 3.3, 4.8),
  food("builtin:rice-white-raw", "大米（生）", "raw", 365, 7.1, 0.7, 80),
  food("builtin:rice-white-cooked", "米饭（熟）", "cooked", 130, 2.7, 0.3, 28.2),
  food("builtin:oats-dry", "燕麦片（干）", "raw", 379, 13.2, 6.5, 67.7),
  food("builtin:sweet-potato-cooked", "红薯（熟）", "cooked", 90, 2, 0.2, 20.7),
  food("builtin:broccoli-cooked", "西兰花（熟）", "cooked", 35, 2.4, 0.4, 7.2),
  food("builtin:spinach-cooked", "菠菜（熟）", "cooked", 23, 3, 0.3, 3.8),
  food("builtin:banana-raw", "香蕉", "raw", 89, 1.1, 0.3, 22.8),
  food("builtin:apple-raw", "苹果", "raw", 52, 0.3, 0.2, 13.8),
  food("builtin:peanuts-roasted", "花生（烤）", "cooked", 587, 24.4, 49.7, 21.3),
  food("builtin:cooking-oil", "食用油", "packaged", 884, 0, 100, 0),
]);

export function calculateEntryNutrition(entry) {
  assertPositiveInteger(entry?.grams, "grams");
  return scaleNutrition(entry, entry.grams / 100);
}

export function sumNutrition(entries) {
  if (!Array.isArray(entries)) throw new TypeError("entries 必须是数组");
  const total = emptyNutrition();
  for (const entry of entries) {
    assertPositiveInteger(entry?.grams, "grams");
    const factor = entry.grams / 100;
    total.energyKcal += entry.energyKcalPer100g * factor;
    total.proteinGrams += entry.proteinGramsPer100g * factor;
    total.fatGrams += entry.fatGramsPer100g * factor;
    total.carbsGrams += entry.carbsGramsPer100g * factor;
  }
  return roundNutrition(total);
}

export function calculateRecipeNutrition(recipe) {
  assertPositiveInteger(recipe?.finishedWeightGrams, "finishedWeightGrams");
  const total = sumNutrition(recipe.ingredients);
  return {
    total,
    per100g: roundNutrition({
      energyKcal: total.energyKcal * 100 / recipe.finishedWeightGrams,
      proteinGrams: total.proteinGrams * 100 / recipe.finishedWeightGrams,
      fatGrams: total.fatGrams * 100 / recipe.finishedWeightGrams,
      carbsGrams: total.carbsGrams * 100 / recipe.finishedWeightGrams,
    }),
  };
}

export function createFoodEntry(
  foodValue,
  inputQuantity,
  confidence,
  id,
  inputUnit = "grams",
  unitGrams = 1,
) {
  assertPositiveInteger(inputQuantity, "inputQuantity");
  assertPositiveInteger(unitGrams, "unitGrams");
  if (!["grams", "piece"].includes(inputUnit)) {
    throw new TypeError("inputUnit 必须是 grams 或 piece");
  }
  if (inputUnit === "grams" && unitGrams !== 1) {
    throw new TypeError("按克录入时 unitGrams 必须为 1");
  }
  const grams = inputQuantity * unitGrams;
  assertPositiveInteger(grams, "grams");
  if (typeof id !== "string") throw new TypeError("id 必须是字符串");
  return {
    id,
    foodRef: foodValue.ref,
    name: foodValue.name,
    foodState: foodValue.foodState,
    grams,
    inputUnit,
    inputQuantity,
    unitGrams,
    energyKcalPer100g: foodValue.energyKcalPer100g,
    proteinGramsPer100g: foodValue.proteinGramsPer100g,
    fatGramsPer100g: foodValue.fatGramsPer100g,
    carbsGramsPer100g: foodValue.carbsGramsPer100g,
    source: foodValue.source,
    confidence,
  };
}

export function getFoodCatalog(data, options = {}) {
  assertValidData(data);
  const includeRecipes = options.includeRecipes !== false;
  const builtIn = BUILT_IN_FOODS.map((item) => ({ ...item }));
  const custom = data.customFoods.map((item) => ({
    ref: `custom:${item.id}`,
    name: item.name,
    foodState: item.foodState,
    energyKcalPer100g: item.energyKcalPer100g,
    proteinGramsPer100g: item.proteinGramsPer100g,
    fatGramsPer100g: item.fatGramsPer100g,
    carbsGramsPer100g: item.carbsGramsPer100g,
    source: "custom",
  }));
  const recipes = includeRecipes
    ? data.recipes.map((recipe) => {
      const nutrition = calculateRecipeNutrition(recipe).per100g;
      return {
        ref: `recipe:${recipe.id}`,
        name: recipe.name,
        foodState: "prepared",
        energyKcalPer100g: nutrition.energyKcal,
        proteinGramsPer100g: nutrition.proteinGrams,
        fatGramsPer100g: nutrition.fatGrams,
        carbsGramsPer100g: nutrition.carbsGrams,
        source: "recipe",
      };
    })
    : [];
  const favorites = new Map(
    data.foodPreferences.favoriteRefs.map((ref, index) => [ref, index]),
  );
  const recent = new Map(
    data.foodPreferences.recentRefs.map((ref, index) => [ref, index]),
  );
  return [...builtIn, ...custom, ...recipes].sort((left, right) => {
    const priority = foodPriority(left.ref, favorites, recent)
      - foodPriority(right.ref, favorites, recent);
    return priority || left.name.localeCompare(right.name, "zh-CN");
  });
}

export function formatNutrition(nutrition) {
  return `${formatNumber(nutrition.energyKcal)} kcal · 蛋白质 ${formatNumber(nutrition.proteinGrams)} g · 脂肪 ${formatNumber(nutrition.fatGrams)} g · 碳水 ${formatNumber(nutrition.carbsGrams)} g`;
}

export function roundNutrition(value) {
  return {
    energyKcal: roundOne(value.energyKcal),
    proteinGrams: roundOne(value.proteinGrams),
    fatGrams: roundOne(value.fatGrams),
    carbsGrams: roundOne(value.carbsGrams),
  };
}

function food(ref, name, foodState, energy, protein, fat, carbs, pieceGrams = null) {
  return Object.freeze({
    ref,
    name,
    foodState,
    energyKcalPer100g: energy,
    proteinGramsPer100g: protein,
    fatGramsPer100g: fat,
    carbsGramsPer100g: carbs,
    source: "builtIn",
    pieceGrams,
  });
}

function emptyNutrition() {
  return { energyKcal: 0, proteinGrams: 0, fatGrams: 0, carbsGrams: 0 };
}

function scaleNutrition(value, factor) {
  return roundNutrition({
    energyKcal: value.energyKcalPer100g * factor,
    proteinGrams: value.proteinGramsPer100g * factor,
    fatGrams: value.fatGramsPer100g * factor,
    carbsGrams: value.carbsGramsPer100g * factor,
  });
}

function roundOne(value) {
  return Math.round((value + Number.EPSILON) * 10) / 10;
}

function formatNumber(value) {
  return Number(value.toFixed(1)).toString();
}

function foodPriority(ref, favorites, recent) {
  if (favorites.has(ref)) return -2_000 + favorites.get(ref);
  if (recent.has(ref)) return -1_000 + recent.get(ref);
  return 0;
}

function assertPositiveInteger(value, path) {
  if (!Number.isInteger(value) || value < 1 || value > 100_000) {
    throw new TypeError(`${path} 必须是 1～100000 的整数`);
  }
}
