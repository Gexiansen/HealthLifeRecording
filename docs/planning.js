import {
  PLAN_STATUSES,
  TRAINING_PLAN_TYPES,
  WORKDAY_TYPES,
} from "./model.js";

export const WORKDAY_LABELS = Object.freeze({
  normal: "正常工作日",
  overtime25: "加班至 19:20",
  overtime30: "加班至 19:50",
  overtime35: "加班至 20:20",
  weekendOvertime: "周末加班",
  rest: "休息日",
});

export const TRAINING_PLAN_LABELS = Object.freeze({
  strengthA: "力量 A",
  strengthB: "力量 B",
  runWalk: "跑走结合",
  walking: "步行",
  mobility: "拉伸放松",
  rest: "休息",
});

export const PLAN_STATUS_LABELS = Object.freeze({
  planned: "计划中",
  completed: "已完成",
  shortened: "缩短完成",
  rescheduled: "已改期",
  rest: "休息",
});

export function getWeeklyTrainingForDate(weeklyTraining, date) {
  assertWeeklyTraining(weeklyTraining);
  const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
  if (!Number.isInteger(weekday)) throw new TypeError("date 必须是有效日期");
  const mondayIndex = weekday === 0 ? 6 : weekday - 1;
  return weeklyTraining[mondayIndex];
}

export function findDailyPlan(trainingPlan, date) {
  return trainingPlan.dailyPlans.find((plan) => plan.date === date) ?? null;
}

export function getEffectiveTraining(trainingPlan, date) {
  const dailyPlan = findDailyPlan(trainingPlan, date);
  return dailyPlan?.trainingOverride
    ?? getWeeklyTrainingForDate(trainingPlan.weeklyTraining, date);
}

export function createDailyAdvice(trainingPlan, date) {
  const dailyPlan = findDailyPlan(trainingPlan, date);
  const plannedTraining = getEffectiveTraining(trainingPlan, date);
  const workdayType = dailyPlan?.workdayType ?? null;
  const status = dailyPlan?.status ?? "planned";

  if (!workdayType) {
    return {
      workdayType,
      plannedTraining,
      recommendedTraining: plannedTraining,
      status,
      headline: TRAINING_PLAN_LABELS[plannedTraining],
      detail: "设置当天工作安排后，会结合下班时间给出更具体的建议。",
      mealReminder: null,
    };
  }

  if (["overtime30", "overtime35"].includes(workdayType)) {
    return {
      workdayType,
      plannedTraining,
      recommendedTraining: "rest",
      status,
      headline: plannedTraining === "rest" ? "今晚休息" : `建议休息，原计划 ${TRAINING_PLAN_LABELS[plannedTraining]}`,
      detail: "晚间不安排正式训练，优先保证晚餐、放松和睡眠。",
      mealReminder: "尽量在 18:00～18:30 吃晚餐，到家后只补少量食物。",
    };
  }

  if (workdayType === "overtime25" && ["strengthA", "strengthB", "runWalk"].includes(plannedTraining)) {
    return {
      workdayType,
      plannedTraining,
      recommendedTraining: plannedTraining,
      status,
      headline: `${TRAINING_PLAN_LABELS[plannedTraining]}，可缩短完成`,
      detail: "根据当天精神状态完成 20～30 分钟；疲劳时直接休息。",
      mealReminder: "训练前安排少量蛋白质和易消化碳水。",
    };
  }

  if (workdayType === "weekendOvertime") {
    return {
      workdayType,
      plannedTraining,
      recommendedTraining: "rest",
      status,
      headline: plannedTraining === "rest" ? "加班日休息" : `建议改期，原计划 ${TRAINING_PLAN_LABELS[plannedTraining]}`,
      detail: "当天不补训练，可手动改到下一个休息日。",
      mealReminder: null,
    };
  }

  return {
    workdayType,
    plannedTraining,
    recommendedTraining: plannedTraining,
    status,
    headline: TRAINING_PLAN_LABELS[plannedTraining],
    detail: plannedTraining === "rest"
      ? "今天以恢复为主，不需要为了完成打卡额外训练。"
      : workdayType === "normal"
        ? "优先按每周模板执行；状态不足时可选择缩短完成。"
        : "休息日按身体状态执行，保留充分恢复时间。",
    mealReminder: null,
  };
}

function assertWeeklyTraining(weeklyTraining) {
  if (!Array.isArray(weeklyTraining) || weeklyTraining.length !== 7) {
    throw new TypeError("weeklyTraining 必须包含 7 项");
  }
  weeklyTraining.forEach((type) => {
    if (!TRAINING_PLAN_TYPES.includes(type)) throw new TypeError("weeklyTraining 包含无效训练类型");
  });
}

export function isValidWorkdayType(value) {
  return WORKDAY_TYPES.includes(value);
}

export function isValidPlanStatus(value) {
  return PLAN_STATUSES.includes(value);
}
