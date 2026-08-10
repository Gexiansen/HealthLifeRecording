import { assertValidData } from "./model.js?v=30";
import { calculateMealProteinSummary } from "./nutrition.js?v=30";

const CARDIO_WORKOUT_TYPES = Object.freeze(["running", "cardio", "walking", "ballSports"]);

export function calculateHealthStageProgress(data, stageId, asOfDate) {
  assertValidData(data);
  assertDate(asOfDate, "asOfDate");
  const stage = data.healthStages.find((item) => item.id === stageId);
  if (!stage) throw new TypeError(`找不到健康阶段：${stageId}`);

  const hasStarted = asOfDate >= stage.startDate;
  const effectiveEndDate = hasStarted
    ? [asOfDate, stage.endDate].sort()[0]
    : stage.startDate;
  const elapsedDays = hasStarted
    ? dateToEpochDay(effectiveEndDate) - dateToEpochDay(stage.startDate) + 1
    : 0;
  const inRange = (record) => elapsedDays > 0
    && record.date >= stage.startDate
    && record.date <= effectiveEndDate;

  const meals = data.meals.filter(inRange);
  const protein = {
    target: stage.goals.protein === null ? null : structuredClone(stage.goals.protein),
    mealCount: meals.length,
    estimatedProteinMilligrams: 0,
    estimatedMealCount: 0,
    partialMealCount: 0,
    unestimatedMealCount: 0,
    coveragePercent: 0,
  };
  for (const meal of meals) {
    const summary = calculateMealProteinSummary(meal.foodItems, meal.freeText);
    protein.estimatedProteinMilligrams += summary.estimatedProteinMilligrams;
    if (summary.status === "estimated") protein.estimatedMealCount += 1;
    else if (summary.status === "partial") protein.partialMealCount += 1;
    else protein.unestimatedMealCount += 1;
  }
  if (protein.mealCount) {
    protein.coveragePercent = Math.round(
      (protein.estimatedMealCount + protein.partialMealCount) / protein.mealCount * 100,
    );
  }

  const workouts = data.workouts.filter(inRange);
  return {
    period: {
      startDate: stage.startDate,
      endDate: effectiveEndDate,
      elapsedDays,
    },
    protein,
    strength: {
      targetSessionsPerWeek: stage.goals.strength?.sessionsPerWeek ?? null,
      count: workouts.filter((record) => record.type === "strength").length,
    },
    cardio: {
      targetSessionsPerWeek: stage.goals.cardio?.sessionsPerWeek ?? null,
      count: workouts.filter((record) => CARDIO_WORKOUT_TYPES.includes(record.type)).length,
    },
  };
}

function assertDate(value, path) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new TypeError(`${path} 必须是 YYYY-MM-DD`);
  }
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new TypeError(`${path} 不是有效日期`);
  }
}

function dateToEpochDay(value) {
  return Date.parse(`${value}T00:00:00Z`) / 86_400_000;
}
