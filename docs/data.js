import { assertValidData, serializeData } from "./model.js?v=35";
import { calculateFoodProteinMilligrams } from "./nutrition.js?v=35";

export const COLLECTIONS = Object.freeze([
  "workouts",
  "meals",
  "sleepRecords",
  "weights",
]);

export function saveRecord(data, collectionName, record) {
  assertCollection(collectionName);
  const next = cloneData(data);
  const index = next[collectionName].findIndex((item) => item.id === record.id);

  if (index === -1) {
    next[collectionName].push(structuredClone(record));
  } else {
    next[collectionName][index] = structuredClone(record);
  }

  assertValidData(next);
  return next;
}

export function deleteRecord(data, collectionName, recordId) {
  assertCollection(collectionName);
  const next = cloneData(data);
  const index = next[collectionName].findIndex((item) => item.id === recordId);
  if (index === -1) {
    throw new TypeError(`找不到记录：${recordId}`);
  }

  const [deletedRecord] = next[collectionName].splice(index, 1);
  assertValidData(next);
  return { data: next, deletedRecord };
}

export function findRecord(data, collectionName, recordId) {
  assertCollection(collectionName);
  return data[collectionName].find((item) => item.id === recordId) ?? null;
}

export function findDailyRecord(data, collectionName, date) {
  if (!["sleepRecords", "weights"].includes(collectionName)) {
    throw new TypeError(`${collectionName} 不支持每日唯一查询`);
  }
  return data[collectionName].find((item) => item.date === date) ?? null;
}

export function recordsForDate(data, date) {
  return COLLECTIONS.flatMap((collectionName) =>
    data[collectionName]
      .filter((record) => record.date === date)
      .map((record) => ({ collectionName, record })),
  );
}

export function allRecordsByDate(data) {
  return COLLECTIONS.flatMap((collectionName) =>
    data[collectionName].map((record) => ({ collectionName, record })),
  ).sort((left, right) => {
    const dateOrder = right.record.date.localeCompare(left.record.date);
    if (dateOrder !== 0) return dateOrder;
    return right.record.createdAt.localeCompare(left.record.createdAt);
  });
}

export function updateWeeklyTraining(data, weeklyTraining) {
  const next = cloneData(data);
  next.weeklyTraining = structuredClone(weeklyTraining);
  assertValidData(next);
  return next;
}

export function saveFood(data, food) {
  const next = cloneData(data);
  const index = next.foods.findIndex((item) => item.id === food.id);
  if (index === -1) next.foods.push(structuredClone(food));
  else next.foods[index] = structuredClone(food);
  assertValidData(next);
  return next;
}

export function getFoodProteinHistoryImpact(data, food) {
  saveFood(data, food);
  const previousFood = data.foods.find((item) => item.id === food.id) ?? null;
  if (previousFood === null) return null;
  const analysis = analyzeFoodProteinHistory(data, previousFood, food);
  return analysis === null ? null : summarizeFoodProteinHistory(analysis);
}

export function saveFoodWithProteinHistory(data, food) {
  const next = saveFood(data, food);
  const previousFood = data.foods.find((item) => item.id === food.id) ?? null;
  if (previousFood === null) throw new TypeError("新增食材没有可修正的历史估算");
  const analysis = analyzeFoodProteinHistory(data, previousFood, food);
  if (analysis === null) throw new TypeError("没有需要同步修正的历史蛋白质估算");
  if (!analysis.syncAllowed) throw new TypeError("当前单位或口径不允许批量修正历史估算");

  const eligibleItemIds = new Set(analysis.eligibleEntries.map(({ item }) => item.id));
  next.meals = next.meals.map((meal) => {
    if (!meal.foodItems.some((item) => eligibleItemIds.has(item.id))) return meal;
    return {
      ...meal,
      foodItems: meal.foodItems.map((item) => eligibleItemIds.has(item.id)
        ? {
          ...item,
          proteinEstimate: createHistoricalProteinEstimate(food, item.amount, item.unit),
        }
        : item),
      updatedAt: food.updatedAt,
    };
  });
  assertValidData(next);
  return {
    data: next,
    impact: summarizeFoodProteinHistory(analysis),
  };
}

export function deleteFood(data, foodId) {
  const next = cloneData(data);
  const index = next.foods.findIndex((item) => item.id === foodId);
  if (index === -1) throw new TypeError(`找不到食材：${foodId}`);
  const [deletedFood] = next.foods.splice(index, 1);
  assertValidData(next);
  return { data: next, deletedFood };
}

export function reorderFoods(data, orderedIds) {
  if (!Array.isArray(orderedIds) || orderedIds.length !== data.foods.length) {
    throw new TypeError("orderedIds 必须包含全部食材 ID");
  }
  const byId = new Map(data.foods.map((food) => [food.id, food]));
  if (byId.size !== orderedIds.length || new Set(orderedIds).size !== orderedIds.length) {
    throw new TypeError("orderedIds 包含重复或缺失 ID");
  }
  const next = cloneData(data);
  next.foods = orderedIds.map((id) => {
    const food = byId.get(id);
    if (!food) throw new TypeError(`找不到食材：${id}`);
    return structuredClone(food);
  });
  assertValidData(next);
  return next;
}

function cloneData(data) {
  assertValidData(data);
  return JSON.parse(serializeData(data));
}

function analyzeFoodProteinHistory(data, previousFood, nextFood) {
  if (!proteinDefinitionChanged(previousFood, nextFood)) return null;
  const historyEntries = data.meals.flatMap((meal) => meal.foodItems
    .filter((item) => item.sourceFoodId === nextFood.id)
    .map((item) => ({ meal, item })));
  if (historyEntries.length === 0) return null;

  let blockedReason = null;
  if (previousFood.unit !== nextFood.unit) blockedReason = "unitChanged";
  else if (
    previousFood.proteinReference !== null
    && nextFood.proteinReference !== null
    && previousFood.proteinReference.basis !== nextFood.proteinReference.basis
  ) blockedReason = "basisChanged";

  const eligibleEntries = blockedReason === null
    ? historyEntries.filter(({ item }) => isHistoryItemCompatible(item, nextFood))
    : [];
  if (blockedReason === null && eligibleEntries.length === 0) {
    blockedReason = "incompatibleHistory";
  }

  return {
    historyEntries,
    eligibleEntries,
    syncAllowed: blockedReason === null,
    blockedReason,
    nextFood,
  };
}

function summarizeFoodProteinHistory(analysis) {
  const historyDates = analysis.historyEntries.map(({ meal }) => meal.date).sort();
  const eligibleDates = analysis.eligibleEntries.map(({ meal }) => meal.date).sort();
  const previousEstimatedEntries = analysis.eligibleEntries.filter(
    ({ item }) => item.proteinEstimate !== null,
  );
  const nextEstimatedMealCount = analysis.nextFood.proteinReference === null
    ? 0
    : analysis.eligibleEntries.length;
  const nextProteinMilligrams = analysis.nextFood.proteinReference === null
    ? 0
    : analysis.eligibleEntries.reduce((total, { item }) => total + calculateFoodProteinMilligrams(
      analysis.nextFood,
      item.amount,
      item.unit,
    ), 0);
  return {
    historyMealCount: analysis.historyEntries.length,
    eligibleMealCount: analysis.eligibleEntries.length,
    skippedMealCount: analysis.historyEntries.length - analysis.eligibleEntries.length,
    historyStartDate: historyDates[0],
    historyEndDate: historyDates.at(-1),
    syncStartDate: eligibleDates[0] ?? null,
    syncEndDate: eligibleDates.at(-1) ?? null,
    previousEstimatedMealCount: previousEstimatedEntries.length,
    previousProteinMilligrams: previousEstimatedEntries.reduce(
      (total, { item }) => total + item.proteinEstimate.proteinMilligrams,
      0,
    ),
    nextEstimatedMealCount,
    nextProteinMilligrams,
    syncAllowed: analysis.syncAllowed,
    blockedReason: analysis.blockedReason,
  };
}

function proteinDefinitionChanged(previousFood, nextFood) {
  if (
    previousFood.unit !== nextFood.unit
    && (previousFood.proteinReference !== null || nextFood.proteinReference !== null)
  ) return true;
  return !sameProteinReference(previousFood.proteinReference, nextFood.proteinReference);
}

function sameProteinReference(left, right) {
  if (left === null || right === null) return left === right;
  return left.referenceAmount === right.referenceAmount
    && left.proteinMilligrams === right.proteinMilligrams
    && left.basis === right.basis
    && left.source === right.source
    && left.sourceNote === right.sourceNote;
}

function isHistoryItemCompatible(item, food) {
  if (item.unit !== food.unit) return false;
  return food.proteinReference === null
    || item.proteinEstimate === null
    || item.proteinEstimate.basis === food.proteinReference.basis;
}

function createHistoricalProteinEstimate(food, amount, unit) {
  if (food.proteinReference === null) return null;
  return {
    proteinMilligrams: calculateFoodProteinMilligrams(food, amount, unit),
    referenceAmount: food.proteinReference.referenceAmount,
    referenceProteinMilligrams: food.proteinReference.proteinMilligrams,
    basis: food.proteinReference.basis,
    source: food.proteinReference.source,
    sourceNote: food.proteinReference.sourceNote,
  };
}

function assertCollection(collectionName) {
  if (!COLLECTIONS.includes(collectionName)) {
    throw new TypeError(`未知记录集合：${collectionName}`);
  }
}
