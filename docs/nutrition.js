import { FOOD_CATEGORIES, FOOD_UNITS, MEAL_TYPES } from "./model.js?v=36";

const UNIT_LABELS = Object.freeze({
  grams: "g",
  milliliters: "ml",
  piece: "个",
  serving: "份",
});

const DEFAULT_MEAL_PROTEIN_TARGETS = Object.freeze({
  breakfast: Object.freeze({ minimumMilligrams: 30_000, maximumMilligrams: 40_000 }),
  lunch: Object.freeze({ minimumMilligrams: 35_000, maximumMilligrams: 45_000 }),
  dinner: Object.freeze({ minimumMilligrams: 35_000, maximumMilligrams: 45_000 }),
});

const MEAL_PROTEIN_SHARES = Object.freeze({
  breakfast: 0.3,
  lunch: 0.35,
  dinner: 0.35,
});

export function getMealProteinTarget(mealType, dailyTarget = undefined) {
  if (!MEAL_TYPES.includes(mealType)) throw new TypeError("mealType 不是有效餐次");
  if (mealType === "snack") return null;
  if (dailyTarget === undefined) return { ...DEFAULT_MEAL_PROTEIN_TARGETS[mealType] };
  if (dailyTarget === null) return null;
  if (
    typeof dailyTarget !== "object"
    || !Number.isInteger(dailyTarget.minimumMilligrams)
    || !Number.isInteger(dailyTarget.maximumMilligrams)
    || dailyTarget.minimumMilligrams < 1_000
    || dailyTarget.maximumMilligrams < dailyTarget.minimumMilligrams
  ) throw new TypeError("dailyTarget 不是有效蛋白质范围");
  const share = MEAL_PROTEIN_SHARES[mealType];
  return {
    minimumMilligrams: roundMealProteinMilligrams(dailyTarget.minimumMilligrams * share),
    maximumMilligrams: roundMealProteinMilligrams(dailyTarget.maximumMilligrams * share),
  };
}

function roundMealProteinMilligrams(value) {
  return Math.max(5_000, Math.round(value / 5_000) * 5_000);
}

export function calculateFoodProteinMilligrams(food, amount, unit = food?.unit) {
  assertFoodShape(food);
  assertAmount(amount, "amount");
  if (!FOOD_UNITS.includes(unit)) throw new TypeError("unit 不是有效单位");
  if (unit !== food.unit) throw new TypeError("本次份量单位与食材参考单位不一致");
  if (food.proteinReference === null) return null;
  return Math.round(
    food.proteinReference.proteinMilligrams * amount
    / food.proteinReference.referenceAmount,
  );
}

export function createMealFoodSnapshot(food, amount, id) {
  assertFoodShape(food);
  assertAmount(amount, "amount");
  assertUuid(id, "id");
  const proteinMilligrams = calculateFoodProteinMilligrams(food, amount, food.unit);
  return {
    id,
    sourceFoodId: food.id,
    name: food.name,
    category: food.category,
    amount,
    unit: food.unit,
    proteinEstimate: food.proteinReference === null
      ? null
      : {
        proteinMilligrams,
        referenceAmount: food.proteinReference.referenceAmount,
        referenceProteinMilligrams: food.proteinReference.proteinMilligrams,
        basis: food.proteinReference.basis,
        source: food.proteinReference.source,
        sourceNote: food.proteinReference.sourceNote,
      },
  };
}

export function foodFromMealSnapshot(snapshot) {
  assertMealSnapshotShape(snapshot);
  return {
    id: snapshot.sourceFoodId,
    name: snapshot.name,
    category: snapshot.category,
    defaultAmount: snapshot.amount,
    unit: snapshot.unit,
    proteinReference: snapshot.proteinEstimate === null
      ? null
      : {
        referenceAmount: snapshot.proteinEstimate.referenceAmount,
        proteinMilligrams: snapshot.proteinEstimate.referenceProteinMilligrams,
        basis: snapshot.proteinEstimate.basis,
        source: snapshot.proteinEstimate.source,
        sourceNote: snapshot.proteinEstimate.sourceNote,
      },
  };
}

export function calculateMealProteinSummary(foodItems, freeText = "") {
  if (!Array.isArray(foodItems)) throw new TypeError("foodItems 必须是数组");
  if (typeof freeText !== "string") throw new TypeError("freeText 必须是字符串");
  let estimatedProteinMilligrams = 0;
  let estimatedItemCount = 0;
  let unestimatedItemCount = 0;
  for (const item of foodItems) {
    assertMealSnapshotShape(item);
    if (item.proteinEstimate === null) {
      unestimatedItemCount += 1;
    } else {
      estimatedItemCount += 1;
      estimatedProteinMilligrams += item.proteinEstimate.proteinMilligrams;
    }
  }
  if (freeText.trim()) unestimatedItemCount += 1;
  const status = estimatedItemCount === 0
    ? "unestimated"
    : unestimatedItemCount === 0
      ? "estimated"
      : "partial";
  return {
    status,
    estimatedProteinMilligrams,
    estimatedItemCount,
    unestimatedItemCount,
  };
}

export function calculateDailyProteinSummary(meals, date) {
  if (!Array.isArray(meals)) throw new TypeError("meals 必须是数组");
  assertDate(date);
  const dailyMeals = meals.filter((record) => record.date === date);
  const result = {
    mealCount: dailyMeals.length,
    estimatedProteinMilligrams: 0,
    estimatedMealCount: 0,
    partialMealCount: 0,
    unestimatedMealCount: 0,
  };
  for (const record of dailyMeals) {
    const summary = calculateMealProteinSummary(record.foodItems, record.freeText);
    result.estimatedProteinMilligrams += summary.estimatedProteinMilligrams;
    if (summary.status === "estimated") result.estimatedMealCount += 1;
    else if (summary.status === "partial") result.partialMealCount += 1;
    else result.unestimatedMealCount += 1;
  }
  return result;
}

export function buildMealContent(foodItems, freeText) {
  if (!Array.isArray(foodItems)) throw new TypeError("foodItems 必须是数组");
  if (typeof freeText !== "string") throw new TypeError("freeText 必须是字符串");
  const parts = foodItems.map((item) => {
    assertMealSnapshotShape(item);
    return `${item.name} ${item.amount} ${UNIT_LABELS[item.unit]}`;
  });
  const trimmed = freeText.trim();
  if (trimmed) parts.push(trimmed);
  const content = parts.join("，");
  if (!content) throw new TypeError("请至少选择一种食材或填写饮食内容");
  if (content.length > 2_000) throw new TypeError("饮食内容不能超过 2000 个字符");
  return content;
}

export function formatProteinGrams(milligrams) {
  if (!Number.isInteger(milligrams) || milligrams < 0) {
    throw new TypeError("milligrams 必须是非负整数");
  }
  return Number((milligrams / 1_000).toFixed(1)).toString();
}

export function formatFoodAmount(amount, unit) {
  assertAmount(amount, "amount");
  if (!FOOD_UNITS.includes(unit)) throw new TypeError("unit 不是有效单位");
  return `${amount} ${UNIT_LABELS[unit]}`;
}

function assertFoodShape(food) {
  if (food === null || typeof food !== "object" || Array.isArray(food)) {
    throw new TypeError("food 必须是对象");
  }
  assertUuid(food.id, "food.id");
  if (typeof food.name !== "string" || !food.name.trim()) {
    throw new TypeError("food.name 不能为空");
  }
  if (!FOOD_CATEGORIES.includes(food.category)) throw new TypeError("food.category 无效");
  assertAmount(food.defaultAmount, "food.defaultAmount");
  if (!FOOD_UNITS.includes(food.unit)) throw new TypeError("food.unit 无效");
  if (food.proteinReference !== null) {
    assertAmount(food.proteinReference?.referenceAmount, "food.proteinReference.referenceAmount");
    if (
      !Number.isInteger(food.proteinReference.proteinMilligrams)
      || food.proteinReference.proteinMilligrams < 0
    ) throw new TypeError("food.proteinReference.proteinMilligrams 必须是非负整数");
  }
}

function assertMealSnapshotShape(item) {
  if (item === null || typeof item !== "object" || Array.isArray(item)) {
    throw new TypeError("foodItem 必须是对象");
  }
  assertUuid(item.id, "foodItem.id");
  assertUuid(item.sourceFoodId, "foodItem.sourceFoodId");
  if (typeof item.name !== "string" || !item.name.trim()) {
    throw new TypeError("foodItem.name 不能为空");
  }
  if (!FOOD_CATEGORIES.includes(item.category)) throw new TypeError("foodItem.category 无效");
  assertAmount(item.amount, "foodItem.amount");
  if (!FOOD_UNITS.includes(item.unit)) throw new TypeError("foodItem.unit 无效");
  if (item.proteinEstimate !== null) {
    if (
      !Number.isInteger(item.proteinEstimate?.proteinMilligrams)
      || item.proteinEstimate.proteinMilligrams < 0
    ) throw new TypeError("foodItem.proteinEstimate.proteinMilligrams 必须是非负整数");
  }
}

function assertAmount(value, path) {
  if (!Number.isInteger(value) || value < 1 || value > 100_000) {
    throw new TypeError(`${path} 必须是 1～100000 的整数`);
  }
}

function assertUuid(value, path) {
  if (
    typeof value !== "string"
    || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  ) throw new TypeError(`${path} 必须是 UUID`);
}

function assertDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new TypeError("date 必须是 YYYY-MM-DD");
  }
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new TypeError("date 不是有效日期");
  }
}
