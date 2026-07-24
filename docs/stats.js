import {
  assertValidData,
  calculateSleepMinutes,
  calculateWeightMovingAverage,
} from "./model.js";

export function calculateTrendSummary(data, endDate, days) {
  assertValidData(data);
  assertDays(days);
  const startDate = shiftDate(endDate, -(days - 1));
  const inRange = (record) => record.date >= startDate && record.date <= endDate;

  const weights = data.weights.filter(inRange).sort(byDate);
  const weightPoints = weights.map((record) => ({
    date: record.date,
    weightGrams: record.weightGrams,
    movingAverageGrams: calculateWeightMovingAverage(data.weights, record.date, 7).averageGrams,
  }));

  const sleepRecords = data.sleepRecords.filter(inRange);
  const sleepMinutes = sleepRecords.map((record) => calculateSleepMinutes(record.sleepTime, record.wakeTime));
  const workouts = data.workouts.filter(inRange);
  const meals = data.meals.filter(inRange);
  const hydration = data.hydration.filter(inRange);

  return {
    period: { startDate, endDate, days },
    weight: {
      sampleCount: weights.length,
      latestGrams: weights.length ? weights.at(-1).weightGrams : null,
      changeGrams: weights.length >= 2 ? weights.at(-1).weightGrams - weights[0].weightGrams : null,
      points: weightPoints,
    },
    sleep: {
      sampleCount: sleepRecords.length,
      averageMinutes: averageRounded(sleepMinutes),
      averageQuality: averageFixed(sleepRecords.map((record) => record.qualityScore)),
    },
    workout: {
      count: workouts.length,
      totalMinutes: workouts.reduce((sum, record) => sum + record.durationMinutes, 0),
      byType: sumBy(workouts, (record) => record.type, (record) => record.durationMinutes),
    },
    meal: {
      count: meals.length,
      recordedDays: new Set(meals.map((record) => record.date)).size,
      completionPercent: Math.round(new Set(meals.map((record) => record.date)).size / days * 100),
      averageHealth: averageFixed(meals.map((record) => record.healthScore)),
      averageFullness: averageFixed(meals.map((record) => record.fullnessScore)),
    },
    hydration: {
      sampleCount: hydration.length,
      averageMilliliters: averageRounded(hydration.map((record) => record.milliliters)),
    },
  };
}

export function calculateTrendComparison(data, endDate, days) {
  const current = calculateTrendSummary(data, endDate, days);
  const previous = calculateTrendSummary(data, shiftDate(current.period.startDate, -1), days);
  return {
    current,
    previous,
    changes: {
      weightGrams: difference(current.weight.latestGrams, previous.weight.latestGrams),
      sleepMinutes: difference(current.sleep.averageMinutes, previous.sleep.averageMinutes),
      workoutMinutes: previous.workout.count && current.workout.count
        ? current.workout.totalMinutes - previous.workout.totalMinutes
        : null,
      mealCompletionPoints: previous.meal.count && current.meal.count
        ? current.meal.completionPercent - previous.meal.completionPercent
        : null,
      hydrationMilliliters: difference(
        current.hydration.averageMilliliters,
        previous.hydration.averageMilliliters,
      ),
    },
  };
}

function sumBy(records, keySelector, valueSelector) {
  const result = {};
  for (const record of records) {
    const key = keySelector(record);
    result[key] = (result[key] ?? 0) + valueSelector(record);
  }
  return result;
}

function averageRounded(values) {
  if (!values.length) return null;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function averageFixed(values) {
  if (!values.length) return null;
  return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(1));
}

function difference(current, previous) {
  return current === null || previous === null ? null : current - previous;
}

function assertDays(days) {
  if (!Number.isInteger(days) || days < 1 || days > 365) {
    throw new TypeError("days 必须是 1～365 的整数");
  }
}

function shiftDate(value, offset) {
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new TypeError("endDate 必须是有效日期");
  }
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

function byDate(left, right) {
  return left.date.localeCompare(right.date);
}
