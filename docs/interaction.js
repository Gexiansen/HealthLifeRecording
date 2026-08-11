const COLLECTIONS = new Set([
  "workouts",
  "meals",
  "sleepRecords",
  "weights",
]);

const REPEATABLE_WORKOUT_SCENARIOS = new Set(["keep", "running", "other"]);
const MEAL_TYPE_ORDER = Object.freeze({ breakfast: 0, lunch: 1, dinner: 2, snack: 3 });

export function getDateContext(selectedDate, today) {
  assertDateString(selectedDate, "selectedDate");
  assertDateString(today, "today");
  if (selectedDate === today) {
    return {
      heading: "今日",
    };
  }
  const [, month, day] = selectedDate.split("-").map(Number);
  return {
    heading: `${month}月${day}日`,
  };
}

export function getDefaultMealType(hour) {
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
    throw new TypeError("hour 必须是 0～23 的整数");
  }
  if (hour < 10) return "breakfast";
  if (hour < 15) return "lunch";
  if (hour < 21) return "dinner";
  return "snack";
}

export function getMealsForDate(meals, date) {
  if (!Array.isArray(meals)) throw new TypeError("meals 必须是数组");
  assertDateString(date, "date");
  return meals
    .filter((meal) => meal?.date === date)
    .sort((left, right) => {
      const typeOrder = MEAL_TYPE_ORDER[left.mealType] - MEAL_TYPE_ORDER[right.mealType];
      return typeOrder || left.createdAt.localeCompare(right.createdAt);
    });
}

export function findMealConflict(meals, date, mealType, currentRecordId = null) {
  if (!(mealType in MEAL_TYPE_ORDER)) throw new TypeError("mealType 不受支持");
  if (currentRecordId !== null && typeof currentRecordId !== "string") {
    throw new TypeError("currentRecordId 必须是字符串或 null");
  }
  return getMealsForDate(meals, date).find((meal) => (
    meal.mealType === mealType && meal.id !== currentRecordId
  )) ?? null;
}

export function getDefaultWorkoutScenario(planType) {
  if (planType === "strengthA" || planType === "strengthB") return "keep";
  if (planType === "runWalk") return "running";
  return "other";
}

export function getLatestWorkoutForScenario(workouts, scenario) {
  if (!Array.isArray(workouts)) throw new TypeError("workouts 必须是数组");
  if (!REPEATABLE_WORKOUT_SCENARIOS.has(scenario)) {
    throw new TypeError("scenario 不支持重复记录");
  }
  return workouts
    .filter((workout) => workout?.scenario === scenario)
    .sort((left, right) => {
      const dateOrder = right.date.localeCompare(left.date);
      return dateOrder || right.createdAt.localeCompare(left.createdAt);
    })[0] ?? null;
}

export function createWorkoutRepeatValues(workout) {
  if (!workout || !REPEATABLE_WORKOUT_SCENARIOS.has(workout.scenario)) {
    throw new TypeError("workout 必须是可重复的运动记录");
  }
  return {
    scenario: workout.scenario,
    type: workout.type,
    durationMinutes: workout.durationMinutes,
    intensity: workout.intensity,
    source: workout.source,
    averageHeartRateBpm: null,
    distanceMeters: workout.scenario === "running" ? workout.distanceMeters : null,
    keepDetails: workout.scenario === "keep"
      ? {
          courseName: workout.keepDetails.courseName,
          completed: true,
          equipmentWeightGrams: workout.keepDetails.equipmentWeightGrams,
          feedbackRecorded: false,
          discomfort: null,
        }
      : null,
    note: "",
  };
}

export function calculatePaceSecondsPerKilometer(durationMinutes, distanceMeters) {
  if (!Number.isInteger(durationMinutes) || durationMinutes < 1 || durationMinutes > 1_440) {
    throw new TypeError("durationMinutes 必须是 1～1440 的整数");
  }
  if (!Number.isInteger(distanceMeters) || distanceMeters < 1 || distanceMeters > 1_000_000) {
    throw new TypeError("distanceMeters 必须是 1～1000000 的整数");
  }
  return Math.round(durationMinutes * 60_000 / distanceMeters);
}

export function calculateVisibilityScroll(viewportTop, viewportBottom, targetTop, targetBottom, gap = 8) {
  if (targetBottom > viewportBottom - gap) return targetBottom - viewportBottom + gap;
  if (targetTop < viewportTop + gap) return targetTop - viewportTop - gap;
  return 0;
}

export function filterRecordItems(items, collectionName = "all", month = "") {
  if (!Array.isArray(items)) throw new TypeError("items 必须是数组");
  if (collectionName !== "all" && !COLLECTIONS.has(collectionName)) {
    throw new TypeError("collectionName 不受支持");
  }
  if (month !== "" && !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    throw new TypeError("month 必须是 YYYY-MM");
  }
  return items.filter((item) => {
    const typeMatches = collectionName === "all" || item.collectionName === collectionName;
    const monthMatches = month === "" || item.record.date.startsWith(`${month}-`);
    return typeMatches && monthMatches;
  });
}

export function getRestoreLabel(currentCount, incomingCount) {
  if (!Number.isInteger(currentCount) || currentCount < 0 || !Number.isInteger(incomingCount) || incomingCount < 0) {
    throw new TypeError("记录数量必须是非负整数");
  }
  if (currentCount === 0) {
    return {
      summary: `将恢复备份中的 ${incomingCount} 条记录。`,
      action: `恢复 ${incomingCount} 条记录`,
    };
  }
  return {
    summary: `当前 ${currentCount} 条记录将被备份中的 ${incomingCount} 条完整替换；替换前会先下载当前数据。`,
    action: `用 ${incomingCount} 条替换当前 ${currentCount} 条`,
  };
}

function assertDateString(value, name) {
  if (typeof value !== "string" || !/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(value)) {
    throw new TypeError(`${name} 必须是 YYYY-MM-DD`);
  }
}
