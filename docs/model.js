export const SCHEMA_VERSION = 4;

export const WORKOUT_TYPES = Object.freeze([
  "strength",
  "running",
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

export const FOOD_STATES = Object.freeze(["raw", "cooked", "packaged", "prepared"]);
export const FOOD_SOURCES = Object.freeze(["builtIn", "custom", "recipe", "estimated"]);
export const NUTRITION_CONFIDENCE = Object.freeze(["high", "medium", "low"]);
export const MEAL_TRACKING_MODES = Object.freeze(["precise", "estimated"]);
export const RECORD_SOURCES = Object.freeze(["manual", "appleWatch"]);
export const FOOD_INPUT_UNITS = Object.freeze(["grams", "piece"]);
export const WORKDAY_TYPES = Object.freeze([
  "normal",
  "overtime25",
  "overtime30",
  "overtime35",
  "weekendOvertime",
  "rest",
]);
export const TRAINING_PLAN_TYPES = Object.freeze([
  "strengthA",
  "strengthB",
  "runWalk",
  "walking",
  "mobility",
  "rest",
]);
export const PLAN_STATUSES = Object.freeze([
  "planned",
  "completed",
  "shortened",
  "rescheduled",
  "rest",
]);

const ROOT_KEYS = Object.freeze([
  "schemaVersion",
  "settings",
  "trainingPlan",
  "foodPreferences",
  "customFoods",
  "recipes",
  "workouts",
  "dailyActivities",
  "meals",
  "sleepRecords",
  "weights",
  "hydration",
]);

const V3_ROOT_KEYS = Object.freeze(ROOT_KEYS.filter((key) => key !== "trainingPlan"));

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
      eggGramsPerPiece: 50,
    },
    trainingPlan: {
      weeklyTraining: [
        "rest",
        "strengthA",
        "rest",
        "strengthB",
        "rest",
        "runWalk",
        "rest",
      ],
      dailyPlans: [],
    },
    foodPreferences: {
      favoriteRefs: [],
      recentRefs: [],
    },
    customFoods: [],
    recipes: [],
    workouts: [],
    dailyActivities: [],
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
  validateTrainingPlan(data.trainingPlan);
  validateFoodPreferences(data.foodPreferences);
  validateCustomFoods(data.customFoods);
  validateRecipes(data.recipes);
  validateRecordArray(data.workouts, "workouts", validateWorkout);
  validateRecordArray(data.dailyActivities, "dailyActivities", validateDailyActivity);
  validateRecordArray(data.meals, "meals", validateMeal);
  validateRecordArray(data.sleepRecords, "sleepRecords", validateSleep);
  validateRecordArray(data.weights, "weights", validateWeight);
  validateRecordArray(data.hydration, "hydration", validateHydration);
  assertGlobalUniqueIds(data);
  assertUniqueDates(data.sleepRecords, "sleepRecords");
  assertUniqueDates(data.weights, "weights");
  assertUniqueDates(data.hydration, "hydration");
  assertUniqueDates(data.dailyActivities, "dailyActivities");
  assertUniqueDates(data.trainingPlan.dailyPlans, "trainingPlan.dailyPlans");
  return true;
}

export function migrateV3Data(value) {
  assertPlainObject(value, "data");
  assertExactKeys(value, V3_ROOT_KEYS, "data");
  if (value.schemaVersion !== 3) {
    throw new TypeError(`不支持迁移的 schemaVersion：${String(value.schemaVersion)}`);
  }
  const next = structuredClone(value);
  next.schemaVersion = SCHEMA_VERSION;
  next.trainingPlan = createEmptyData().trainingPlan;
  assertValidData(next);
  return next;
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
  assertExactKeys(
    settings,
    ["weightUnit", "goalWeightGrams", "eggGramsPerPiece"],
    "settings",
  );
  assertEnum(settings.weightUnit, ["kg", "lb"], "settings.weightUnit");
  assertNullableIntegerInRange(
    settings.goalWeightGrams,
    20_000,
    500_000,
    "settings.goalWeightGrams",
  );
  assertIntegerInRange(settings.eggGramsPerPiece, 20, 100, "settings.eggGramsPerPiece");
}

function validateTrainingPlan(trainingPlan) {
  assertPlainObject(trainingPlan, "trainingPlan");
  assertExactKeys(trainingPlan, ["weeklyTraining", "dailyPlans"], "trainingPlan");
  if (!Array.isArray(trainingPlan.weeklyTraining) || trainingPlan.weeklyTraining.length !== 7) {
    throw new TypeError("trainingPlan.weeklyTraining 必须包含周一至周日 7 项");
  }
  trainingPlan.weeklyTraining.forEach((type, index) => {
    assertEnum(type, TRAINING_PLAN_TYPES, `trainingPlan.weeklyTraining[${index}]`);
  });
  if (!Array.isArray(trainingPlan.dailyPlans) || trainingPlan.dailyPlans.length > 3_650) {
    throw new TypeError("trainingPlan.dailyPlans 必须是最多 3650 项的数组");
  }
  trainingPlan.dailyPlans.forEach((plan, index) => {
    const path = `trainingPlan.dailyPlans[${index}]`;
    validateBaseRecord(
      plan,
      [
        ...BASE_RECORD_KEYS,
        "workdayType",
        "trainingOverride",
        "status",
        "rescheduledToDate",
      ],
      path,
    );
    assertEnum(plan.workdayType, WORKDAY_TYPES, `${path}.workdayType`);
    if (plan.trainingOverride !== null) {
      assertEnum(plan.trainingOverride, TRAINING_PLAN_TYPES, `${path}.trainingOverride`);
    }
    assertEnum(plan.status, PLAN_STATUSES, `${path}.status`);
    if (plan.status === "rescheduled") {
      assertDate(plan.rescheduledToDate, `${path}.rescheduledToDate`);
      if (plan.rescheduledToDate === plan.date) {
        throw new TypeError(`${path}.rescheduledToDate 不能与原日期相同`);
      }
    } else if (plan.rescheduledToDate !== null) {
      throw new TypeError(`${path}.rescheduledToDate 仅在改期时填写`);
    }
  });
}

function validateFoodPreferences(preferences) {
  assertPlainObject(preferences, "foodPreferences");
  assertExactKeys(preferences, ["favoriteRefs", "recentRefs"], "foodPreferences");
  assertUniqueStringArray(preferences.favoriteRefs, 100, "foodPreferences.favoriteRefs");
  assertUniqueStringArray(preferences.recentRefs, 12, "foodPreferences.recentRefs");
}

function validateCustomFoods(foods) {
  if (!Array.isArray(foods) || foods.length > 500) {
    throw new TypeError("customFoods 必须是最多 500 项的数组");
  }
  foods.forEach((food, index) => validateCustomFood(food, `customFoods[${index}]`));
}

function validateCustomFood(food, path) {
  assertPlainObject(food, path);
  assertExactKeys(food, [
    "id",
    "name",
    "foodState",
    "energyKcalPer100g",
    "proteinGramsPer100g",
    "fatGramsPer100g",
    "carbsGramsPer100g",
    "createdAt",
    "updatedAt",
  ], path);
  assertUuid(food.id, `${path}.id`);
  assertStringLength(food.name, 1, 60, `${path}.name`);
  assertEnum(food.foodState, FOOD_STATES, `${path}.foodState`);
  validateNutritionPer100g(food, path);
  assertTimestamps(food, path);
}

function validateRecipes(recipes) {
  if (!Array.isArray(recipes) || recipes.length > 200) {
    throw new TypeError("recipes 必须是最多 200 项的数组");
  }
  recipes.forEach((recipe, index) => {
    const path = `recipes[${index}]`;
    assertPlainObject(recipe, path);
    assertExactKeys(recipe, [
      "id",
      "name",
      "ingredients",
      "finishedWeightGrams",
      "createdAt",
      "updatedAt",
    ], path);
    assertUuid(recipe.id, `${path}.id`);
    assertStringLength(recipe.name, 1, 60, `${path}.name`);
    validateFoodEntries(recipe.ingredients, `${path}.ingredients`, 1, 50);
    assertIntegerInRange(recipe.finishedWeightGrams, 1, 100_000, `${path}.finishedWeightGrams`);
    assertTimestamps(recipe, path);
  });
}

function validateWorkout(record, path) {
  validateBaseRecord(
    record,
    [
      ...BASE_RECORD_KEYS,
      "type",
      "durationMinutes",
      "intensity",
      "source",
      "activeEnergyKcal",
      "averageHeartRateBpm",
      "maxHeartRateBpm",
      "distanceMeters",
      "note",
    ],
    path,
  );
  assertEnum(record.type, WORKOUT_TYPES, `${path}.type`);
  assertIntegerInRange(record.durationMinutes, 1, 1_440, `${path}.durationMinutes`);
  assertIntegerInRange(record.intensity, 1, 3, `${path}.intensity`);
  assertEnum(record.source, RECORD_SOURCES, `${path}.source`);
  assertNullableIntegerInRange(record.activeEnergyKcal, 1, 10_000, `${path}.activeEnergyKcal`);
  assertNullableIntegerInRange(
    record.averageHeartRateBpm,
    30,
    240,
    `${path}.averageHeartRateBpm`,
  );
  assertNullableIntegerInRange(record.maxHeartRateBpm, 30, 240, `${path}.maxHeartRateBpm`);
  if (
    record.averageHeartRateBpm !== null
    && record.maxHeartRateBpm !== null
    && record.maxHeartRateBpm < record.averageHeartRateBpm
  ) {
    throw new TypeError(`${path}.maxHeartRateBpm 不能低于平均心率`);
  }
  assertNullableIntegerInRange(record.distanceMeters, 1, 1_000_000, `${path}.distanceMeters`);
  if (
    record.distanceMeters !== null
    && !["running", "walking", "cardio"].includes(record.type)
  ) {
    throw new TypeError(`${path}.distanceMeters 只适用于跑步、步行或有氧`);
  }
  assertStringLength(record.note, 0, 500, `${path}.note`);
}

function validateDailyActivity(record, path) {
  validateBaseRecord(
    record,
    [...BASE_RECORD_KEYS, "steps", "source", "note"],
    path,
  );
  assertIntegerInRange(record.steps, 1, 100_000, `${path}.steps`);
  assertEnum(record.source, RECORD_SOURCES, `${path}.source`);
  assertStringLength(record.note, 0, 500, `${path}.note`);
}

function validateMeal(record, path) {
  validateBaseRecord(
    record,
    [
      ...BASE_RECORD_KEYS,
      "mealType",
      "trackingMode",
      "confidence",
      "items",
      "healthScore",
      "fullnessScore",
      "note",
    ],
    path,
  );
  assertEnum(record.mealType, MEAL_TYPES, `${path}.mealType`);
  assertEnum(record.trackingMode, MEAL_TRACKING_MODES, `${path}.trackingMode`);
  assertEnum(record.confidence, NUTRITION_CONFIDENCE, `${path}.confidence`);
  if (record.trackingMode === "precise" && record.confidence === "low") {
    throw new TypeError(`${path}.confidence 与精确模式不匹配`);
  }
  validateFoodEntries(record.items, `${path}.items`, 1, 50);
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
  assertUuid(record.id, `${path}.id`);
  assertDate(record.date, `${path}.date`);
  assertTimestamps(record, path);
}

function validateFoodEntries(entries, path, min, max) {
  if (!Array.isArray(entries) || entries.length < min || entries.length > max) {
    throw new TypeError(`${path} 必须包含 ${min}～${max} 项`);
  }
  entries.forEach((entry, index) => {
    const entryPath = `${path}[${index}]`;
    assertPlainObject(entry, entryPath);
    assertExactKeys(entry, [
      "id",
      "foodRef",
      "name",
      "foodState",
      "grams",
      "inputUnit",
      "inputQuantity",
      "unitGrams",
      "energyKcalPer100g",
      "proteinGramsPer100g",
      "fatGramsPer100g",
      "carbsGramsPer100g",
      "source",
      "confidence",
    ], entryPath);
    assertUuid(entry.id, `${entryPath}.id`);
    assertStringLength(entry.foodRef, 1, 100, `${entryPath}.foodRef`);
    assertStringLength(entry.name, 1, 60, `${entryPath}.name`);
    assertEnum(entry.foodState, FOOD_STATES, `${entryPath}.foodState`);
    assertIntegerInRange(entry.grams, 1, 100_000, `${entryPath}.grams`);
    assertEnum(entry.inputUnit, FOOD_INPUT_UNITS, `${entryPath}.inputUnit`);
    assertIntegerInRange(entry.inputQuantity, 1, 100_000, `${entryPath}.inputQuantity`);
    assertIntegerInRange(entry.unitGrams, 1, 100_000, `${entryPath}.unitGrams`);
    if (entry.inputUnit === "grams" && entry.unitGrams !== 1) {
      throw new TypeError(`${entryPath}.unitGrams 按克录入时必须为 1`);
    }
    if (entry.grams !== entry.inputQuantity * entry.unitGrams) {
      throw new TypeError(`${entryPath}.grams 与录入数量换算不一致`);
    }
    validateNutritionPer100g(entry, entryPath);
    assertEnum(entry.source, FOOD_SOURCES, `${entryPath}.source`);
    assertEnum(entry.confidence, NUTRITION_CONFIDENCE, `${entryPath}.confidence`);
  });
}

function validateNutritionPer100g(value, path) {
  assertDecimalInRange(value.energyKcalPer100g, 0, 1_000, `${path}.energyKcalPer100g`);
  assertDecimalInRange(value.proteinGramsPer100g, 0, 100, `${path}.proteinGramsPer100g`);
  assertDecimalInRange(value.fatGramsPer100g, 0, 100, `${path}.fatGramsPer100g`);
  assertDecimalInRange(value.carbsGramsPer100g, 0, 100, `${path}.carbsGramsPer100g`);
}

function validateRecordArray(records, path, validate) {
  if (!Array.isArray(records)) {
    throw new TypeError(`${path} 必须是数组`);
  }
  records.forEach((record, index) => validate(record, `${path}[${index}]`));
}

function assertGlobalUniqueIds(data) {
  const seen = new Set();
  const collect = (id) => {
    if (seen.has(id)) throw new TypeError(`记录 ID 重复：${id}`);
    seen.add(id);
  };
  for (const food of data.customFoods) collect(food.id);
  for (const recipe of data.recipes) {
    collect(recipe.id);
    recipe.ingredients.forEach((entry) => collect(entry.id));
  }
  for (const collectionName of [
    "workouts",
    "dailyActivities",
    "meals",
    "sleepRecords",
    "weights",
    "hydration",
  ]) {
    for (const record of data[collectionName]) {
      collect(record.id);
      if (collectionName === "meals") {
        record.items.forEach((entry) => collect(entry.id));
      }
    }
  }
  for (const plan of data.trainingPlan.dailyPlans) collect(plan.id);
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

function assertDecimalInRange(value, min, max, path) {
  if (
    typeof value !== "number"
    || !Number.isFinite(value)
    || value < min
    || value > max
    || Math.abs(value * 10 - Math.round(value * 10)) > 1e-9
  ) {
    throw new TypeError(`${path} 必须是 ${min}～${max} 且最多一位小数的数字`);
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

function assertUniqueStringArray(values, max, path) {
  if (!Array.isArray(values) || values.length > max) {
    throw new TypeError(`${path} 必须是最多 ${max} 项的数组`);
  }
  const seen = new Set();
  values.forEach((value, index) => {
    assertStringLength(value, 1, 100, `${path}[${index}]`);
    if (seen.has(value)) throw new TypeError(`${path} 包含重复值`);
    seen.add(value);
  });
}

function assertUuid(value, path) {
  if (typeof value !== "string" || !UUID_PATTERN.test(value)) {
    throw new TypeError(`${path} 必须是 UUID`);
  }
}

function assertTimestamps(value, path) {
  assertIsoTimestamp(value.createdAt, `${path}.createdAt`);
  assertIsoTimestamp(value.updatedAt, `${path}.updatedAt`);
  if (value.updatedAt < value.createdAt) {
    throw new TypeError(`${path}.updatedAt 不能早于 createdAt`);
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
