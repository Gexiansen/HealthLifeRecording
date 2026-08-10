export const SCHEMA_VERSION = 12;
export const PREVIOUS_SCHEMA_VERSION = 11;
export const LEGACY_SCHEMA_VERSION = 10;

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

export const RECORD_SOURCES = Object.freeze(["manual", "appleWatch"]);
export const WORKOUT_SCENARIOS = Object.freeze(["keep", "running", "other", "guided"]);
export const TRAINING_PLAN_TYPES = Object.freeze([
  "strengthA",
  "strengthB",
  "runWalk",
  "rest",
]);
export const GUIDED_EXERCISE_UNITS = Object.freeze([
  "reps",
  "repsEachSide",
  "floors",
  "minutes",
]);
export const GUIDED_EXERCISE_STATUSES = Object.freeze(["completed", "shortened", "skipped"]);
export const DISCOMFORT_BODY_PARTS = Object.freeze([
  "knee",
  "lowerBack",
  "shoulder",
  "elbow",
  "wrist",
  "hip",
  "ankle",
  "other",
]);
export const FOOD_CATEGORIES = Object.freeze([
  "protein",
  "staple",
  "vegetable",
  "fruit",
  "dairy",
  "drink",
  "other",
]);
export const FOOD_UNITS = Object.freeze(["grams", "milliliters", "piece", "serving"]);
export const FOOD_BASIS_TYPES = Object.freeze(["raw", "cooked", "edible", "packaged"]);
export const PROTEIN_SOURCE_TYPES = Object.freeze([
  "packageLabel",
  "publicReference",
  "other",
]);
export const HEALTH_STAGE_STATUSES = Object.freeze(["active", "completed"]);

const ROOT_KEYS = Object.freeze([
  "schemaVersion",
  "weeklyTraining",
  "foods",
  "healthStages",
  "workouts",
  "meals",
  "sleepRecords",
  "weights",
]);

const V10_ROOT_KEYS = Object.freeze([
  "schemaVersion",
  "weeklyTraining",
  "workouts",
  "meals",
  "sleepRecords",
  "weights",
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
    weeklyTraining: [
      "rest",
      "strengthA",
      "rest",
      "strengthB",
      "rest",
      "runWalk",
      "rest",
    ],
    foods: [],
    healthStages: [],
    workouts: [],
    meals: [],
    sleepRecords: [],
    weights: [],
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

  validateWeeklyTraining(data.weeklyTraining);
  validateRecordArray(data.foods, "foods", validateFood);
  validateRecordArray(data.healthStages, "healthStages", validateHealthStage);
  validateRecordArray(data.workouts, "workouts", validateWorkout);
  validateRecordArray(data.meals, "meals", validateMeal);
  validateRecordArray(data.sleepRecords, "sleepRecords", validateSleep);
  validateRecordArray(data.weights, "weights", validateWeight);
  assertGlobalUniqueIds(data);
  assertUniqueFoodNames(data.foods);
  assertSingleActiveHealthStage(data.healthStages);
  assertUniqueDates(data.sleepRecords, "sleepRecords");
  assertUniqueDates(data.weights, "weights");
  return true;
}

export function assertValidDataV10(data) {
  assertPlainObject(data, "data");
  assertExactKeys(data, V10_ROOT_KEYS, "data");
  if (data.schemaVersion !== LEGACY_SCHEMA_VERSION) {
    throw new TypeError(`不支持的 schemaVersion：${String(data.schemaVersion)}`);
  }
  validateWeeklyTraining(data.weeklyTraining);
  validateRecordArray(data.workouts, "workouts", validateWorkoutV11);
  validateRecordArray(data.meals, "meals", validateMealV10);
  validateRecordArray(data.sleepRecords, "sleepRecords", validateSleep);
  validateRecordArray(data.weights, "weights", validateWeight);
  assertGlobalUniqueIdsV10(data);
  assertUniqueDates(data.sleepRecords, "sleepRecords");
  assertUniqueDates(data.weights, "weights");
  return true;
}

export function assertValidDataV11(data) {
  assertPlainObject(data, "data");
  assertExactKeys(data, ROOT_KEYS, "data");
  if (data.schemaVersion !== PREVIOUS_SCHEMA_VERSION) {
    throw new TypeError(`不支持的 schemaVersion：${String(data.schemaVersion)}`);
  }
  validateWeeklyTraining(data.weeklyTraining);
  validateRecordArray(data.foods, "foods", validateFood);
  validateRecordArray(data.healthStages, "healthStages", validateHealthStage);
  validateRecordArray(data.workouts, "workouts", validateWorkoutV11);
  validateRecordArray(data.meals, "meals", validateMeal);
  validateRecordArray(data.sleepRecords, "sleepRecords", validateSleep);
  validateRecordArray(data.weights, "weights", validateWeight);
  assertGlobalUniqueIds(data);
  assertUniqueFoodNames(data.foods);
  assertSingleActiveHealthStage(data.healthStages);
  assertUniqueDates(data.sleepRecords, "sleepRecords");
  assertUniqueDates(data.weights, "weights");
  return true;
}

export function migrateDataV11(data) {
  assertValidDataV11(data);
  const migrated = {
    ...structuredClone(data),
    schemaVersion: SCHEMA_VERSION,
    workouts: data.workouts.map((record) => ({
      ...structuredClone(record),
      scenario: record.guidedSession !== null
        ? "guided"
        : record.type === "running"
          ? "running"
          : "other",
      keepDetails: null,
    })),
  };
  assertValidData(migrated);
  return migrated;
}

export function migrateDataV10(data) {
  assertValidDataV10(data);
  const v11 = {
    schemaVersion: PREVIOUS_SCHEMA_VERSION,
    weeklyTraining: structuredClone(data.weeklyTraining),
    foods: [],
    healthStages: [],
    workouts: structuredClone(data.workouts),
    meals: data.meals.map((record) => ({
      ...structuredClone(record),
      freeText: record.content,
      foodItems: [],
    })),
    sleepRecords: structuredClone(data.sleepRecords),
    weights: structuredClone(data.weights),
  };
  assertValidDataV11(v11);
  return migrateDataV11(v11);
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

export function parseDataV10(text) {
  if (typeof text !== "string") {
    throw new TypeError("备份内容必须是字符串");
  }
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new TypeError("备份内容不是有效 JSON");
  }
  assertValidDataV10(data);
  return data;
}

export function parseDataV11(text) {
  if (typeof text !== "string") {
    throw new TypeError("备份内容必须是字符串");
  }
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new TypeError("备份内容不是有效 JSON");
  }
  assertValidDataV11(data);
  return data;
}

function validateWeeklyTraining(weeklyTraining) {
  if (!Array.isArray(weeklyTraining) || weeklyTraining.length !== 7) {
    throw new TypeError("weeklyTraining 必须包含周一至周日 7 项");
  }
  weeklyTraining.forEach((type, index) => {
    assertEnum(type, TRAINING_PLAN_TYPES, `weeklyTraining[${index}]`);
  });
}

function validateFood(record, path) {
  assertPlainObject(record, path);
  assertExactKeys(record, [
    "id",
    "name",
    "category",
    "defaultAmount",
    "unit",
    "proteinReference",
    "createdAt",
    "updatedAt",
  ], path);
  assertUuid(record.id, `${path}.id`);
  assertNonBlankString(record.name, 1, 80, `${path}.name`);
  assertEnum(record.category, FOOD_CATEGORIES, `${path}.category`);
  assertIntegerInRange(record.defaultAmount, 1, 100_000, `${path}.defaultAmount`);
  assertEnum(record.unit, FOOD_UNITS, `${path}.unit`);
  validateProteinReference(record.proteinReference, `${path}.proteinReference`);
  assertTimestamps(record, path);
}

function validateProteinReference(reference, path) {
  if (reference === null) return;
  assertPlainObject(reference, path);
  assertExactKeys(reference, [
    "referenceAmount",
    "proteinMilligrams",
    "basis",
    "source",
    "sourceNote",
  ], path);
  assertIntegerInRange(reference.referenceAmount, 1, 100_000, `${path}.referenceAmount`);
  assertIntegerInRange(reference.proteinMilligrams, 0, 1_000_000, `${path}.proteinMilligrams`);
  assertEnum(reference.basis, FOOD_BASIS_TYPES, `${path}.basis`);
  assertEnum(reference.source, PROTEIN_SOURCE_TYPES, `${path}.source`);
  assertStringLength(reference.sourceNote, 0, 300, `${path}.sourceNote`);
}

function validateHealthStage(stage, path) {
  assertPlainObject(stage, path);
  assertExactKeys(stage, [
    "id",
    "title",
    "startDate",
    "endDate",
    "status",
    "completedAt",
    "goals",
    "createdAt",
    "updatedAt",
  ], path);
  assertUuid(stage.id, `${path}.id`);
  assertNonBlankString(stage.title, 1, 80, `${path}.title`);
  assertDate(stage.startDate, `${path}.startDate`);
  assertDate(stage.endDate, `${path}.endDate`);
  const durationDays = dateToEpochDay(stage.endDate) - dateToEpochDay(stage.startDate) + 1;
  if (durationDays < 1 || durationDays > 84) {
    throw new TypeError(`${path} 周期必须为 1～84 个自然日`);
  }
  assertEnum(stage.status, HEALTH_STAGE_STATUSES, `${path}.status`);
  if (stage.status === "active" && stage.completedAt !== null) {
    throw new TypeError(`${path}.completedAt 活动阶段必须为 null`);
  }
  if (stage.status === "completed") {
    assertIsoTimestamp(stage.completedAt, `${path}.completedAt`);
  }
  validateHealthStageGoals(stage.goals, `${path}.goals`);
  assertTimestamps(stage, path);
}

function validateHealthStageGoals(goals, path) {
  assertPlainObject(goals, path);
  assertExactKeys(goals, ["protein", "strength", "cardio"], path);
  let enabledCount = 0;
  if (goals.protein !== null) {
    enabledCount += 1;
    assertPlainObject(goals.protein, `${path}.protein`);
    assertExactKeys(
      goals.protein,
      ["minimumMilligrams", "maximumMilligrams"],
      `${path}.protein`,
    );
    assertIntegerInRange(
      goals.protein.minimumMilligrams,
      1_000,
      500_000,
      `${path}.protein.minimumMilligrams`,
    );
    assertIntegerInRange(
      goals.protein.maximumMilligrams,
      1_000,
      500_000,
      `${path}.protein.maximumMilligrams`,
    );
    if (goals.protein.maximumMilligrams < goals.protein.minimumMilligrams) {
      throw new TypeError(`${path}.protein 最大值不能小于最小值`);
    }
  }
  for (const type of ["strength", "cardio"]) {
    const goal = goals[type];
    if (goal === null) continue;
    enabledCount += 1;
    assertPlainObject(goal, `${path}.${type}`);
    assertExactKeys(goal, ["sessionsPerWeek"], `${path}.${type}`);
    assertIntegerInRange(goal.sessionsPerWeek, 1, 14, `${path}.${type}.sessionsPerWeek`);
  }
  if (enabledCount < 1 || enabledCount > 2) {
    throw new TypeError(`${path} 必须启用 1～2 个行动重点`);
  }
}

function validateWorkout(record, path) {
  validateBaseRecord(
    record,
    [
      ...BASE_RECORD_KEYS,
      "scenario",
      "type",
      "durationMinutes",
      "intensity",
      "source",
      "averageHeartRateBpm",
      "distanceMeters",
      "keepDetails",
      "guidedSession",
      "note",
    ],
    path,
  );
  assertEnum(record.scenario, WORKOUT_SCENARIOS, `${path}.scenario`);
  validateWorkoutCommon(record, path);
  validateKeepDetails(record.keepDetails, `${path}.keepDetails`);
  validateGuidedSession(record.guidedSession, `${path}.guidedSession`);
  if (record.scenario === "keep") {
    if (record.keepDetails === null) throw new TypeError(`${path}.keepDetails Keep 场景不能为空`);
    if (record.guidedSession !== null) throw new TypeError(`${path}.guidedSession Keep 场景必须为 null`);
    if (record.type === "running") throw new TypeError(`${path}.type Keep 场景不能使用跑步类型`);
    if (record.distanceMeters !== null) throw new TypeError(`${path}.distanceMeters Keep 场景必须为 null`);
  } else if (record.scenario === "running") {
    if (record.type !== "running") throw new TypeError(`${path}.type 跑步场景必须为 running`);
    if (record.keepDetails !== null || record.guidedSession !== null) {
      throw new TypeError(`${path} 跑步场景不能包含 Keep 或引导训练详情`);
    }
  } else if (record.scenario === "other") {
    if (record.type === "running") throw new TypeError(`${path}.type 其他运动场景不能使用 running`);
    if (record.keepDetails !== null || record.guidedSession !== null) {
      throw new TypeError(`${path} 其他运动场景不能包含 Keep 或引导训练详情`);
    }
  } else {
    if (record.guidedSession === null) throw new TypeError(`${path}.guidedSession 引导场景不能为空`);
    if (record.keepDetails !== null) throw new TypeError(`${path}.keepDetails 引导场景必须为 null`);
  }
}

function validateWorkoutV11(record, path) {
  validateBaseRecord(
    record,
    [
      ...BASE_RECORD_KEYS,
      "type",
      "durationMinutes",
      "intensity",
      "source",
      "averageHeartRateBpm",
      "distanceMeters",
      "guidedSession",
      "note",
    ],
    path,
  );
  validateWorkoutCommon(record, path);
  validateGuidedSession(record.guidedSession, `${path}.guidedSession`);
}

function validateWorkoutCommon(record, path) {
  assertEnum(record.type, WORKOUT_TYPES, `${path}.type`);
  assertIntegerInRange(record.durationMinutes, 1, 1_440, `${path}.durationMinutes`);
  assertIntegerInRange(record.intensity, 1, 3, `${path}.intensity`);
  assertEnum(record.source, RECORD_SOURCES, `${path}.source`);
  assertNullableIntegerInRange(
    record.averageHeartRateBpm,
    30,
    240,
    `${path}.averageHeartRateBpm`,
  );
  assertNullableIntegerInRange(record.distanceMeters, 1, 1_000_000, `${path}.distanceMeters`);
  if (
    record.distanceMeters !== null
    && !["running", "walking", "cardio"].includes(record.type)
  ) {
    throw new TypeError(`${path}.distanceMeters 只适用于跑步、步行或有氧`);
  }
  assertStringLength(record.note, 0, 500, `${path}.note`);
}

function validateKeepDetails(details, path) {
  if (details === null) return;
  assertPlainObject(details, path);
  assertExactKeys(details, [
    "courseName",
    "completed",
    "equipmentWeightGrams",
    "feedbackRecorded",
    "discomfort",
  ], path);
  assertNonBlankString(details.courseName, 1, 120, `${path}.courseName`);
  if (typeof details.completed !== "boolean") {
    throw new TypeError(`${path}.completed 必须是布尔值`);
  }
  assertNullableIntegerInRange(
    details.equipmentWeightGrams,
    100,
    200_000,
    `${path}.equipmentWeightGrams`,
  );
  if (typeof details.feedbackRecorded !== "boolean") {
    throw new TypeError(`${path}.feedbackRecorded 必须是布尔值`);
  }
  if (!details.feedbackRecorded && details.discomfort !== null) {
    throw new TypeError(`${path}.discomfort 未反馈时必须为 null`);
  }
  validateExerciseDiscomfort(details.discomfort, `${path}.discomfort`);
}

function validateGuidedSession(session, path) {
  if (session === null) return;
  assertPlainObject(session, path);
  assertExactKeys(session, [
    "id",
    "templateId",
    "templateName",
    "startedAt",
    "completedAt",
    "perceivedEffort",
    "exercises",
  ], path);
  assertUuid(session.id, `${path}.id`);
  assertStringLength(session.templateId, 1, 60, `${path}.templateId`);
  assertStringLength(session.templateName, 1, 80, `${path}.templateName`);
  assertIsoTimestamp(session.startedAt, `${path}.startedAt`);
  assertIsoTimestamp(session.completedAt, `${path}.completedAt`);
  if (session.completedAt < session.startedAt) {
    throw new TypeError(`${path}.completedAt 不能早于 startedAt`);
  }
  assertIntegerInRange(session.perceivedEffort, 1, 3, `${path}.perceivedEffort`);
  if (!Array.isArray(session.exercises) || session.exercises.length < 1 || session.exercises.length > 20) {
    throw new TypeError(`${path}.exercises 必须包含 1～20 项`);
  }
  const exerciseIds = new Set();
  session.exercises.forEach((exercise, index) => {
    const exercisePath = `${path}.exercises[${index}]`;
    assertPlainObject(exercise, exercisePath);
    assertExactKeys(exercise, [
      "plannedExerciseId",
      "exerciseId",
      "name",
      "unit",
      "status",
      "sets",
      "feedbackRecorded",
      "discomfort",
    ], exercisePath);
    assertStringLength(exercise.plannedExerciseId, 1, 60, `${exercisePath}.plannedExerciseId`);
    assertStringLength(exercise.exerciseId, 1, 60, `${exercisePath}.exerciseId`);
    if (exerciseIds.has(exercise.exerciseId)) {
      throw new TypeError(`${exercisePath}.exerciseId 重复`);
    }
    exerciseIds.add(exercise.exerciseId);
    assertStringLength(exercise.name, 1, 80, `${exercisePath}.name`);
    assertEnum(exercise.unit, GUIDED_EXERCISE_UNITS, `${exercisePath}.unit`);
    assertEnum(exercise.status, GUIDED_EXERCISE_STATUSES, `${exercisePath}.status`);
    if (!Array.isArray(exercise.sets) || exercise.sets.length > 20) {
      throw new TypeError(`${exercisePath}.sets 必须是最多 20 项的数组`);
    }
    if (exercise.status === "skipped" && exercise.sets.length !== 0) {
      throw new TypeError(`${exercisePath}.sets 跳过动作时必须为空`);
    }
    if (exercise.status !== "skipped" && exercise.sets.length === 0) {
      throw new TypeError(`${exercisePath}.sets 完成动作时不能为空`);
    }
    exercise.sets.forEach((set, setIndex) => {
      const setPath = `${exercisePath}.sets[${setIndex}]`;
      assertPlainObject(set, setPath);
      assertExactKeys(set, ["targetValue", "completedValue", "weightGrams"], setPath);
      assertIntegerInRange(set.targetValue, 1, 1_000, `${setPath}.targetValue`);
      assertIntegerInRange(set.completedValue, 1, 1_000, `${setPath}.completedValue`);
      assertNullableIntegerInRange(set.weightGrams, 100, 200_000, `${setPath}.weightGrams`);
    });
    if (typeof exercise.feedbackRecorded !== "boolean") {
      throw new TypeError(`${exercisePath}.feedbackRecorded 必须是布尔值`);
    }
    if (!exercise.feedbackRecorded && exercise.discomfort !== null) {
      throw new TypeError(`${exercisePath}.discomfort 未反馈时必须为 null`);
    }
    validateExerciseDiscomfort(exercise.discomfort, `${exercisePath}.discomfort`);
  });
}

function validateExerciseDiscomfort(discomfort, path) {
  if (discomfort === null) return;
  assertPlainObject(discomfort, path);
  assertExactKeys(discomfort, ["bodyPart", "severity"], path);
  assertEnum(discomfort.bodyPart, DISCOMFORT_BODY_PARTS, `${path}.bodyPart`);
  assertIntegerInRange(discomfort.severity, 1, 3, `${path}.severity`);
}

function validateMeal(record, path) {
  validateBaseRecord(
    record,
    [
      ...BASE_RECORD_KEYS,
      "mealType",
      "content",
      "freeText",
      "foodItems",
    ],
    path,
  );
  assertEnum(record.mealType, MEAL_TYPES, `${path}.mealType`);
  assertStringLength(record.content, 1, 2_000, `${path}.content`);
  if (!record.content.trim()) {
    throw new TypeError(`${path}.content 不能为空`);
  }
  assertStringLength(record.freeText, 0, 2_000, `${path}.freeText`);
  if (!Array.isArray(record.foodItems) || record.foodItems.length > 50) {
    throw new TypeError(`${path}.foodItems 必须是最多 50 项的数组`);
  }
  const sourceFoodIds = new Set();
  record.foodItems.forEach((item, index) => {
    validateMealFoodItem(item, `${path}.foodItems[${index}]`);
    if (sourceFoodIds.has(item.sourceFoodId)) {
      throw new TypeError(`${path}.foodItems 不能重复选择同一食材`);
    }
    sourceFoodIds.add(item.sourceFoodId);
  });
  if (record.foodItems.length === 0 && !record.freeText.trim()) {
    throw new TypeError(`${path} 必须包含食材或自由文字`);
  }
}

function validateMealV10(record, path) {
  validateBaseRecord(
    record,
    [...BASE_RECORD_KEYS, "mealType", "content"],
    path,
  );
  assertEnum(record.mealType, MEAL_TYPES, `${path}.mealType`);
  assertNonBlankString(record.content, 1, 2_000, `${path}.content`);
}

function validateMealFoodItem(item, path) {
  assertPlainObject(item, path);
  assertExactKeys(item, [
    "id",
    "sourceFoodId",
    "name",
    "category",
    "amount",
    "unit",
    "proteinEstimate",
  ], path);
  assertUuid(item.id, `${path}.id`);
  assertUuid(item.sourceFoodId, `${path}.sourceFoodId`);
  assertNonBlankString(item.name, 1, 80, `${path}.name`);
  assertEnum(item.category, FOOD_CATEGORIES, `${path}.category`);
  assertIntegerInRange(item.amount, 1, 100_000, `${path}.amount`);
  assertEnum(item.unit, FOOD_UNITS, `${path}.unit`);
  if (item.proteinEstimate === null) return;
  assertPlainObject(item.proteinEstimate, `${path}.proteinEstimate`);
  assertExactKeys(item.proteinEstimate, [
    "proteinMilligrams",
    "referenceAmount",
    "referenceProteinMilligrams",
    "basis",
    "source",
    "sourceNote",
  ], `${path}.proteinEstimate`);
  assertIntegerInRange(
    item.proteinEstimate.proteinMilligrams,
    0,
    1_000_000,
    `${path}.proteinEstimate.proteinMilligrams`,
  );
  assertIntegerInRange(
    item.proteinEstimate.referenceAmount,
    1,
    100_000,
    `${path}.proteinEstimate.referenceAmount`,
  );
  assertIntegerInRange(
    item.proteinEstimate.referenceProteinMilligrams,
    0,
    1_000_000,
    `${path}.proteinEstimate.referenceProteinMilligrams`,
  );
  assertEnum(
    item.proteinEstimate.basis,
    FOOD_BASIS_TYPES,
    `${path}.proteinEstimate.basis`,
  );
  assertEnum(
    item.proteinEstimate.source,
    PROTEIN_SOURCE_TYPES,
    `${path}.proteinEstimate.source`,
  );
  assertStringLength(
    item.proteinEstimate.sourceNote,
    0,
    300,
    `${path}.proteinEstimate.sourceNote`,
  );
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

function validateBaseRecord(record, keys, path) {
  assertPlainObject(record, path);
  assertExactKeys(record, keys, path);
  assertUuid(record.id, `${path}.id`);
  assertDate(record.date, `${path}.date`);
  assertTimestamps(record, path);
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
  for (const record of data.foods) collect(record.id);
  for (const stage of data.healthStages) collect(stage.id);
  for (const collectionName of [
    "workouts",
    "meals",
    "sleepRecords",
    "weights",
  ]) {
    for (const record of data[collectionName]) {
      collect(record.id);
      if (collectionName === "workouts" && record.guidedSession !== null) {
        collect(record.guidedSession.id);
      }
      if (collectionName === "meals") {
        for (const item of record.foodItems) collect(item.id);
      }
    }
  }
}

function assertGlobalUniqueIdsV10(data) {
  const seen = new Set();
  const collect = (id) => {
    if (seen.has(id)) throw new TypeError(`记录 ID 重复：${id}`);
    seen.add(id);
  };
  for (const collectionName of ["workouts", "meals", "sleepRecords", "weights"]) {
    for (const record of data[collectionName]) {
      collect(record.id);
      if (collectionName === "workouts" && record.guidedSession !== null) {
        collect(record.guidedSession.id);
      }
    }
  }
}

function assertSingleActiveHealthStage(stages) {
  if (stages.filter((stage) => stage.status === "active").length > 1) {
    throw new TypeError("同一时间最多只能有一个活动阶段");
  }
}

function assertUniqueFoodNames(foods) {
  const seen = new Set();
  for (const food of foods) {
    const name = food.name.trim();
    if (seen.has(name)) throw new TypeError(`常用食材名称重复：${name}`);
    seen.add(name);
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

function assertNonBlankString(value, min, max, path) {
  assertStringLength(value, min, max, path);
  if (!value.trim()) {
    throw new TypeError(`${path} 不能为空`);
  }
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
