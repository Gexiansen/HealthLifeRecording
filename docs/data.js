import { assertValidData, serializeData } from "./model.js";

export const COLLECTIONS = Object.freeze([
  "workouts",
  "dailyActivities",
  "meals",
  "sleepRecords",
  "weights",
  "hydration",
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
  if (!["sleepRecords", "weights", "hydration", "dailyActivities"].includes(collectionName)) {
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

export function saveCustomFood(data, food) {
  const next = cloneData(data);
  const index = next.customFoods.findIndex((item) => item.id === food.id);
  if (index === -1) next.customFoods.push(structuredClone(food));
  else next.customFoods[index] = structuredClone(food);
  assertValidData(next);
  return next;
}

export function saveRecipe(data, recipe) {
  const next = cloneData(data);
  const index = next.recipes.findIndex((item) => item.id === recipe.id);
  if (index === -1) next.recipes.push(structuredClone(recipe));
  else next.recipes[index] = structuredClone(recipe);
  assertValidData(next);
  return next;
}

export function updateFoodPreferences(data, foodRef, favorite = null) {
  if (typeof foodRef !== "string" || foodRef.length < 1 || foodRef.length > 100) {
    throw new TypeError("foodRef 无效");
  }
  const next = cloneData(data);
  next.foodPreferences.recentRefs = [
    foodRef,
    ...next.foodPreferences.recentRefs.filter((ref) => ref !== foodRef),
  ].slice(0, 12);
  if (favorite === true && !next.foodPreferences.favoriteRefs.includes(foodRef)) {
    next.foodPreferences.favoriteRefs.push(foodRef);
  } else if (favorite === false) {
    next.foodPreferences.favoriteRefs = next.foodPreferences.favoriteRefs.filter((ref) => ref !== foodRef);
  }
  assertValidData(next);
  return next;
}

export function updateEggGramsPerPiece(data, grams) {
  const next = cloneData(data);
  next.settings.eggGramsPerPiece = grams;
  assertValidData(next);
  return next;
}

export function updateWeeklyTraining(data, weeklyTraining) {
  const next = cloneData(data);
  next.trainingPlan.weeklyTraining = structuredClone(weeklyTraining);
  assertValidData(next);
  return next;
}

export function saveDailyPlan(data, plan) {
  const next = cloneData(data);
  const existing = next.trainingPlan.dailyPlans.find((item) => item.date === plan.date);
  if (existing?.rescheduledToDate && existing.rescheduledToDate !== plan.rescheduledToDate) {
    const previousTarget = next.trainingPlan.dailyPlans.find(
      (item) => item.date === existing.rescheduledToDate,
    );
    if (previousTarget?.rescheduledFromDate === plan.date) {
      previousTarget.rescheduledFromDate = null;
      previousTarget.updatedAt = plan.updatedAt;
    }
  }
  const index = next.trainingPlan.dailyPlans.findIndex((item) => item.date === plan.date);
  if (index === -1) next.trainingPlan.dailyPlans.push(structuredClone(plan));
  else next.trainingPlan.dailyPlans[index] = structuredClone(plan);
  assertValidData(next);
  return next;
}

export function saveRescheduledPlan(data, sourcePlan, targetPlan) {
  const next = cloneData(data);
  if (
    sourcePlan.status !== "rescheduled"
    || sourcePlan.rescheduledToDate !== targetPlan.date
    || sourcePlan.rescheduledFromDate !== null
    || targetPlan.rescheduledFromDate !== sourcePlan.date
    || targetPlan.rescheduledToDate !== null
  ) {
    throw new TypeError("改期来源与目标关联不完整");
  }

  const existingSource = next.trainingPlan.dailyPlans.find(
    (item) => item.date === sourcePlan.date,
  );
  if (existingSource && existingSource.rescheduledFromDate !== null) {
    throw new TypeError("改期目标不能再次改期");
  }
  if (existingSource?.rescheduledToDate && existingSource.rescheduledToDate !== targetPlan.date) {
    const previousTarget = next.trainingPlan.dailyPlans.find(
      (item) => item.date === existingSource.rescheduledToDate,
    );
    if (previousTarget?.rescheduledFromDate === sourcePlan.date) {
      previousTarget.rescheduledFromDate = null;
      previousTarget.updatedAt = sourcePlan.updatedAt;
    }
  }

  const existingTarget = next.trainingPlan.dailyPlans.find(
    (item) => item.date === targetPlan.date,
  );
  if (existingTarget?.status === "rescheduled") {
    throw new TypeError("目标日期本身已改期，不能作为新的改期目标");
  }
  if (
    existingTarget?.rescheduledFromDate
    && existingTarget.rescheduledFromDate !== sourcePlan.date
  ) {
    throw new TypeError("目标日期已有其他改期计划");
  }

  upsertPlan(next.trainingPlan.dailyPlans, sourcePlan);
  upsertPlan(next.trainingPlan.dailyPlans, targetPlan);
  assertValidData(next);
  return next;
}

function upsertPlan(plans, plan) {
  const index = plans.findIndex((item) => item.date === plan.date);
  if (index === -1) plans.push(structuredClone(plan));
  else plans[index] = structuredClone(plan);
}

function cloneData(data) {
  assertValidData(data);
  return JSON.parse(serializeData(data));
}

function assertCollection(collectionName) {
  if (!COLLECTIONS.includes(collectionName)) {
    throw new TypeError(`未知记录集合：${collectionName}`);
  }
}
