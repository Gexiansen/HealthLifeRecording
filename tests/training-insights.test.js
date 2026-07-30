import test from "node:test";
import assert from "node:assert/strict";

import {
  createProgressionAdvice,
  getExerciseHistory,
  summarizeWorkoutDiscomfort,
} from "../docs/training-insights.js";

function workout({
  id,
  date,
  completedAt,
  exerciseId = "gobletSquat",
  status = "completed",
  effort = 2,
  discomfort = null,
  feedbackRecorded = true,
  weightGrams = 8_000,
}) {
  return {
    id,
    date,
    guidedSession: {
      templateName: "动作适应",
      completedAt,
      perceivedEffort: effort,
      exercises: [{
        plannedExerciseId: "gobletSquat",
        exerciseId,
        status,
        sets: status === "skipped"
          ? []
          : [{ targetValue: 8, completedValue: 8, weightGrams }],
        feedbackRecorded,
        discomfort,
      }],
    },
  };
}

test("同动作历史只返回实际执行的同一动作并按完成时间倒序", () => {
  const workouts = [
    workout({
      id: "1",
      date: "2026-07-28",
      completedAt: "2026-07-28T12:00:00.000Z",
    }),
    workout({
      id: "2",
      date: "2026-07-29",
      completedAt: "2026-07-29T12:00:00.000Z",
      exerciseId: "bodyweightSquat",
      weightGrams: null,
    }),
    workout({
      id: "3",
      date: "2026-07-30",
      completedAt: "2026-07-30T12:00:00.000Z",
    }),
  ];
  const history = getExerciseHistory(workouts, "gobletSquat");
  assert.deepEqual(history.map((item) => item.date), ["2026-07-30", "2026-07-28"]);
});

test("加量建议需要最近两次完整、适中且无不适", () => {
  const one = getExerciseHistory([
    workout({
      id: "1",
      date: "2026-07-29",
      completedAt: "2026-07-29T12:00:00.000Z",
    }),
  ], "gobletSquat");
  assert.equal(createProgressionAdvice(one, "gobletSquat").level, "repeat");

  const two = getExerciseHistory([
    ...one.map((item, index) => workout({
      id: String(index + 1),
      date: item.date,
      completedAt: item.completedAt,
    })),
    workout({
      id: "2",
      date: "2026-07-28",
      completedAt: "2026-07-28T12:00:00.000Z",
    }),
  ], "gobletSquat");
  assert.equal(createProgressionAdvice(two, "gobletSquat").level, "progress");
});

test("最近一次不适或吃力时不会建议加量", () => {
  const discomfort = getExerciseHistory([
    workout({
      id: "1",
      date: "2026-07-30",
      completedAt: "2026-07-30T12:00:00.000Z",
      discomfort: { bodyPart: "knee", severity: 2 },
    }),
  ], "gobletSquat");
  assert.equal(createProgressionAdvice(discomfort, "gobletSquat").level, "caution");

  const hard = getExerciseHistory([
    workout({
      id: "2",
      date: "2026-07-30",
      completedAt: "2026-07-30T12:00:00.000Z",
      effort: 3,
    }),
  ], "gobletSquat");
  assert.equal(createProgressionAdvice(hard, "gobletSquat").level, "reduce");

  const unreported = getExerciseHistory([
    workout({
      id: "3",
      date: "2026-07-30",
      completedAt: "2026-07-30T12:00:00.000Z",
      feedbackRecorded: false,
    }),
  ], "gobletSquat");
  assert.equal(createProgressionAdvice(unreported, "gobletSquat").level, "maintain");
});

test("趋势汇总按日期统计不适部位和明显以上次数", () => {
  const workouts = [
    workout({
      id: "1",
      date: "2026-07-29",
      completedAt: "2026-07-29T12:00:00.000Z",
      discomfort: { bodyPart: "knee", severity: 1 },
    }),
    workout({
      id: "2",
      date: "2026-07-30",
      completedAt: "2026-07-30T12:00:00.000Z",
      discomfort: { bodyPart: "knee", severity: 2 },
    }),
  ];
  assert.deepEqual(summarizeWorkoutDiscomfort(
    workouts,
    "2026-07-29",
    "2026-07-30",
  ), {
    count: 2,
    moderateOrHigher: 1,
    byBodyPart: { knee: 2 },
  });
});
