export const SCHEMA_VERSION = 1;

export const WORKOUT_TYPES = Object.freeze([
  "strength",
  "cardio",
  "walking",
  "stretching",
  "ballSports",
  "other",
]);

export const MEAL_TYPES = Object.freeze([
  "breakfast",
  "lunch",
  "dinner",
  "snack",
]);

const ROOT_KEYS = Object.freeze([
  "schemaVersion",
  "settings",
  "workouts",
  "meals",
  "sleepRecords",
  "weights",
  "hydration",
]);

const BASE_RECORD_KEYS = Object.freeze([
  "id",
  "date",
  "createdAt",
  "updatedAt",
]);

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

export function createEmptyData() {
  return {
    schemaVersion: SCHEMA_VERSION,
    settings: {
      weightUnit: "kg",
      goalWeightGrams: null,
    },
    workouts: [],
    meals: [],
    sleepRecords: [],
    weights: [],
    hydration: [],
  };
}

export function createId() {
  if (!globalThis.crypto?.randomUUID) {
    throw new Error("当前环境不支持 crypto.randomUUID");
  }
  return globalThis.crypto.randomUUID();
}

export function calculateSleepMinutes(sleepTime, wakeTime) {
  assertTime(sleepTime, "sleepTime");
  assertTime(wakeTime, "wakeTime");

  const start = timeToMinutes(sleepTime);
  const end = timeToMinutes(wakeTime);
  if (start === end) {
    throw new TypeError("sleepTime 和 wakeTime 不能相同");
  }
  return end > start ? end - start : 24 * 60 - start + end;
}

export function calculateWeightMovingAverage(weights, endDate, days = 7) {
  assertDate(endDate, "endDate");
  assertIntegerInRange(days, 1, 365, "days");
  if (!Array.isArray(weights)) {
    throw new TypeError("weights 必须是数组");
  }

  const endDay = dateToEpochDay(endDate);
  const startDay = endDay - days + 1;
  const samples = weights.filter((record, index) => {
    validateWeight(record, `weights[${index}]`);
    const day = dateToEpochDay(record.date);
    return day >= startDay && day <= endDay;
  });

  if (samples.length === 0) {
    return { sampleCount: 0, averageGrams: null };
  }

  const total = samples.reduce((sum, record) => sum + record.weightGrams, 0);
  return {
    sampleCount: samples.length,
    averageGrams: Math.round(total / samples.length),
  };
}

export function assertValidData(data) {
  assertPlainObject(data, "data");
  assertExactKeys(data, ROOT_KEYS, "data");

  if (data.schemaVersion !== SCHEMA_VERSION) {
    throw new TypeError(`不支持的 schemaVersion：${String(data.schemaVersion)}`);
  }

  validateSettings(data.settings);
  validateRecordArray(data.workouts, "workouts", validateWorkout);
  validateRecordArray(data.meals, "meals", validateMeal);
  validateRecordArray(data.sleepRecords, "sleepRecords", validateSleep);
  validateRecordArray(data.weights, "weights", validateWeight);
  validateRecordArray(data.hydration, "hydration", validateHydration);
  assertGlobalUniqueIds(data);
  assertUniqueDates(data.sleepRecords, "sleepRecords");
  assertUniqueDates(data.weights, "weights");
  assertUniqueDates(data.hydration, "hydration");
  return true;
}

export function serializeData(data) {
  assertValidData(data);
  return JSON.stringify(data, null, 2);
}

export function parseData(text) {
  if (typeof text !== "string") {
    throw new TypeError("备份内容必须是字符串");
  }

  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new TypeError("备份内容不是有效 JSON");
  }

  assertValidData(data);
  return data;
}

function validateSettings(settings) {
  assertPlainObject(settings, "settings");
  assertExactKeys(settings, ["weightUnit", "goalWeightGrams"], "settings");
  assertEnum(settings.weightUnit, ["kg", "lb"], "settings.weightUnit");
  assertNullableIntegerInRange(
    settings.goalWeightGrams,
    20_000,
    500_000,
    "settings.goalWeightGrams",
  );
}

function validateWorkout(record, path) {
  validateBaseRecord(
    record,
    [...BASE_RECORD_KEYS, "type", "durationMinutes", "intensity", "note"],
    path,
  );
  assertEnum(record.type, WORKOUT_TYPES, `${path}.type`);
  assertIntegerInRange(record.durationMinutes, 1, 1_440, `${path}.durationMinutes`);
  assertIntegerInRange(record.intensity, 1, 3, `${path}.intensity`);
  assertStringLength(record.note, 0, 500, `${path}.note`);
}

function validateMeal(record, path) {
  validateBaseRecord(
    record,
    [
      ...BASE_RECORD_KEYS,
      "mealType",
      "description",
      "healthScore",
      "fullnessScore",
      "note",
    ],
    path,
  );
  assertEnum(record.mealType, MEAL_TYPES, `${path}.mealType`);
  assertStringLength(record.description, 1, 200, `${path}.description`);
  assertIntegerInRange(record.healthScore, 1, 5, `${path}.healthScore`);
  assertIntegerInRange(record.fullnessScore, 1, 5, `${path}.fullnessScore`);
  assertStringLength(record.note, 0, 500, `${path}.note`);
}

function validateSleep(record, path) {
  validateBaseRecord(
    record,
    [
      ...BASE_RECORD_KEYS,
      "sleepTime",
      "wakeTime",
      "qualityScore",
      "awakeCount",
      "note",
    ],
    path,
  );
  calculateSleepMinutes(record.sleepTime, record.wakeTime);
  assertIntegerInRange(record.qualityScore, 1, 5, `${path}.qualityScore`);
  assertIntegerInRange(record.awakeCount, 0, 50, `${path}.awakeCount`);
  assertStringLength(record.note, 0, 500, `${path}.note`);
}

function validateWeight(record, path) {
  validateBaseRecord(
    record,
    [...BASE_RECORD_KEYS, "weightGrams", "bodyFatBasisPoints", "note"],
    path,
  );
  assertIntegerInRange(record.weightGrams, 20_000, 500_000, `${path}.weightGrams`);
  assertNullableIntegerInRange(
    record.bodyFatBasisPoints,
    100,
    7_500,
    `${path}.bodyFatBasisPoints`,
  );
  assertStringLength(record.note, 0, 500, `${path}.note`);
}

function validateHydration(record, path) {
  validateBaseRecord(
    record,
    [...BASE_RECORD_KEYS, "milliliters", "note"],
    path,
  );
  assertIntegerInRange(record.milliliters, 1, 20_000, `${path}.milliliters`);
  assertStringLength(record.note, 0, 500, `${path}.note`);
}

function validateBaseRecord(record, keys, path) {
  assertPlainObject(record, path);
  assertExactKeys(record, keys, path);
  if (typeof record.id !== "string" || !UUID_PATTERN.test(record.id)) {
    throw new TypeError(`${path}.id 必须是 UUID`);
  }
  assertDate(record.date, `${path}.date`);
  assertIsoTimestamp(record.createdAt, `${path}.createdAt`);
  assertIsoTimestamp(record.updatedAt, `${path}.updatedAt`);
  if (record.updatedAt < record.createdAt) {
    throw new TypeError(`${path}.updatedAt 不能早于 createdAt`);
  }
}

function validateRecordArray(records, path, validate) {
  if (!Array.isArray(records)) {
    throw new TypeError(`${path} 必须是数组`);
  }
  records.forEach((record, index) => validate(record, `${path}[${index}]`));
}

function assertGlobalUniqueIds(data) {
  const seen = new Set();
  for (const collectionName of [
    "workouts",
    "meals",
    "sleepRecords",
    "weights",
    "hydration",
  ]) {
    for (const record of data[collectionName]) {
      if (seen.has(record.id)) {
        throw new TypeError(`记录 ID 重复：${record.id}`);
      }
      seen.add(record.id);
    }
  }
}

function assertUniqueDates(records, path) {
  const seen = new Set();
  for (const record of records) {
    if (seen.has(record.date)) {
      throw new TypeError(`${path} 的日期重复：${record.date}`);
    }
    seen.add(record.date);
  }
}

function assertPlainObject(value, path) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${path} 必须是对象`);
  }
}

function assertExactKeys(value, expectedKeys, path) {
  const actual = Object.keys(value).sort();
  const expected = [...expectedKeys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    throw new TypeError(`${path} 字段不完整或包含未知字段`);
  }
}

function assertEnum(value, allowed, path) {
  if (!allowed.includes(value)) {
    throw new TypeError(`${path} 不是有效枚举值`);
  }
}

function assertIntegerInRange(value, min, max, path) {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new TypeError(`${path} 必须是 ${min}～${max} 的整数`);
  }
}

function assertNullableIntegerInRange(value, min, max, path) {
  if (value !== null) {
    assertIntegerInRange(value, min, max, path);
  }
}

function assertStringLength(value, min, max, path) {
  if (typeof value !== "string" || value.length < min || value.length > max) {
    throw new TypeError(`${path} 长度必须为 ${min}～${max}`);
  }
}

function assertDate(value, path) {
  if (typeof value !== "string" || !DATE_PATTERN.test(value)) {
    throw new TypeError(`${path} 必须是 YYYY-MM-DD`);
  }
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new TypeError(`${path} 不是有效日期`);
  }
}

function assertTime(value, path) {
  if (typeof value !== "string" || !TIME_PATTERN.test(value)) {
    throw new TypeError(`${path} 必须是 HH:mm`);
  }
}

function assertIsoTimestamp(value, path) {
  if (typeof value !== "string") {
    throw new TypeError(`${path} 必须是 ISO 8601 时间戳`);
  }
  const timestamp = new Date(value);
  if (Number.isNaN(timestamp.getTime()) || timestamp.toISOString() !== value) {
    throw new TypeError(`${path} 必须是标准 UTC ISO 8601 时间戳`);
  }
}

function timeToMinutes(value) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function dateToEpochDay(value) {
  return Date.parse(`${value}T00:00:00Z`) / 86_400_000;
}
