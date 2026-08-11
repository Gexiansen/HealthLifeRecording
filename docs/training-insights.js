import {
  DISCOMFORT_BODY_PART_LABELS,
  EXERCISE_LIBRARY,
} from "./guided-workout.js?v=35";

export function getExerciseHistory(workouts, exerciseId, limit = 3) {
  if (!Array.isArray(workouts)) throw new TypeError("workouts 必须是数组");
  if (!EXERCISE_LIBRARY[exerciseId]) throw new TypeError("exerciseId 无效");
  if (!Number.isInteger(limit) || limit < 1 || limit > 20) {
    throw new TypeError("limit 必须是 1～20 的整数");
  }
  return workouts
    .flatMap((workout) => {
      const session = workout.guidedSession;
      if (!session) return [];
      const exercise = session.exercises.find(
        (item) => item.exerciseId === exerciseId && item.status !== "skipped",
      );
      if (!exercise) return [];
      return [{
        date: workout.date,
        completedAt: session.completedAt,
        templateName: session.templateName,
        perceivedEffort: session.perceivedEffort,
        status: exercise.status,
        sets: structuredClone(exercise.sets),
        feedbackRecorded: exercise.feedbackRecorded,
        discomfort: exercise.discomfort === null
          ? null
          : structuredClone(exercise.discomfort),
      }];
    })
    .sort((left, right) => right.completedAt.localeCompare(left.completedAt))
    .slice(0, limit);
}

export function createProgressionAdvice(history, exerciseId) {
  if (!Array.isArray(history)) throw new TypeError("history 必须是数组");
  const exercise = EXERCISE_LIBRARY[exerciseId];
  if (!exercise) throw new TypeError("exerciseId 无效");
  if (history.length === 0) {
    return {
      level: "first",
      text: "暂无同动作历史。先选择能保留约 2～3 次余力的难度。",
    };
  }

  const latest = history[0];
  if (!latest.feedbackRecorded) {
    return {
      level: "maintain",
      text: "上次未记录动作后不适反馈，信息不足，本次先维持难度。",
    };
  }
  if (latest.discomfort !== null) {
    const part = DISCOMFORT_BODY_PART_LABELS[latest.discomfort.bodyPart];
    return {
      level: "caution",
      text: `上次记录了${part}${severityLabel(latest.discomfort.severity)}不适。本次不加量；仍有不适时停止该动作。`,
    };
  }
  if (latest.status === "shortened" || latest.perceivedEffort === 3) {
    return {
      level: "reduce",
      text: "上次为缩短完成或整体感受吃力。本次维持或降低难度，优先保证动作稳定。",
    };
  }
  if (history.length < 2) {
    return {
      level: "repeat",
      text: `只有 1 次同动作样本，建议先重复上次的${formatHistoryLoad(latest, exercise)}。`,
    };
  }

  const recent = history.slice(0, 2);
  const ready = recent.every(
    (item) => item.status === "completed"
      && item.perceivedEffort <= 2
      && item.feedbackRecorded
      && item.discomfort === null,
  );
  if (!ready) {
    return {
      level: "maintain",
      text: "最近两次尚未同时满足完整完成、用力适中且无不适，建议维持当前难度。",
    };
  }

  if (exercise.weightEnabled && latest.sets.some((set) => set.weightGrams !== null)) {
    return {
      level: "progress",
      text: `最近两次完成稳定。可选择器械能调整的最小重量档，或每组增加 1 次；不要同时增加。`,
    };
  }
  const increment = exercise.unit === "floors"
    ? "每组增加 1 层"
    : exercise.unit === "minutes"
      ? "每组增加 1 分钟"
      : "每组增加 1 次，最多做到 10～12 次";
  return {
    level: "progress",
    text: `最近两次完成稳定，可以${increment}。`,
  };
}

export function summarizeWorkoutDiscomfort(workouts, startDate, endDate) {
  if (!Array.isArray(workouts)) throw new TypeError("workouts 必须是数组");
  const feedback = workouts
    .filter((workout) => workout.date >= startDate && workout.date <= endDate)
    .flatMap((workout) => workout.guidedSession?.exercises ?? [])
    .filter((exercise) => exercise.discomfort !== null);
  const byBodyPart = {};
  let moderateOrHigher = 0;
  for (const exercise of feedback) {
    const part = exercise.discomfort.bodyPart;
    byBodyPart[part] = (byBodyPart[part] ?? 0) + 1;
    if (exercise.discomfort.severity >= 2) moderateOrHigher += 1;
  }
  return {
    count: feedback.length,
    moderateOrHigher,
    byBodyPart,
  };
}

function formatHistoryLoad(history, exercise) {
  const weights = history.sets
    .map((set) => set.weightGrams)
    .filter((value) => value !== null);
  if (exercise.weightEnabled && weights.length) {
    const latestWeight = weights.at(-1) / 1_000;
    return `${formatDecimal(latestWeight)} kg 和组次`;
  }
  return "组次";
}

function severityLabel(value) {
  return { 1: "轻微", 2: "明显", 3: "严重" }[value];
}

function formatDecimal(value) {
  return value.toFixed(1).replace(/\.0$/, "");
}
