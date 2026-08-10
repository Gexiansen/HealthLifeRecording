import { assertValidData, serializeData } from "./model.js?v=26";

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

function assertCollection(collectionName) {
  if (!COLLECTIONS.includes(collectionName)) {
    throw new TypeError(`未知记录集合：${collectionName}`);
  }
}
