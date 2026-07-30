import test from "node:test";
import assert from "node:assert/strict";

import {
  completeWorkoutSet,
  createGuidedSessionSnapshot,
  createWorkoutDraft,
  estimateWorkoutDurationMinutes,
  EXERCISE_LIBRARY,
  getWorkoutStep,
  GUIDED_TEMPLATES,
  recommendedTemplateId,
  skipWorkoutExercise,
  workoutDraftProgress,
} from "../docs/guided-workout.js";

const SESSION_ID = "10000000-0000-4000-8000-000000000001";
const STARTED_AT = "2026-07-31T10:00:00.000Z";

test("动作库覆盖六个首批动作且当天计划映射推荐模板", () => {
  assert.deepEqual(Object.keys(EXERCISE_LIBRARY), [
    "gobletSquat",
    "dumbbellRomanianDeadlift",
    "pushup",
    "oneArmDumbbellRow",
    "deadBug",
    "stairClimb",
  ]);
  for (const exercise of Object.values(EXERCISE_LIBRARY)) {
    assert.equal(exercise.cues.length, 3);
    assert.ok(exercise.setup.length > 0);
    assert.ok(exercise.stopCondition.length > 0);
  }
  assert.equal(recommendedTemplateId("strengthA"), "strengthA");
  assert.equal(recommendedTemplateId("strengthB"), "strengthB");
  assert.equal(recommendedTemplateId("walking"), "stairBeginner");
  assert.equal(recommendedTemplateId("rest"), null);
});

test("训练草稿按组推进并生成不可变的动作完成快照", () => {
  let draft = createWorkoutDraft({
    templateId: "squatAdaptation",
    date: "2026-07-31",
    id: SESSION_ID,
    now: STARTED_AT,
  });
  assert.equal(getWorkoutStep(draft).exercise.id, "gobletSquat");
  assert.deepEqual(workoutDraftProgress(draft), {
    completedSets: 0,
    totalSets: 3,
    currentExercise: 1,
    totalExercises: 1,
  });

  for (let index = 0; index < 3; index += 1) {
    const previous = draft;
    draft = completeWorkoutSet(draft, {
      completedValue: 8,
      weightGrams: 8_000,
      now: `2026-07-31T10:0${index + 1}:00.000Z`,
    });
    assert.notEqual(draft, previous);
  }
  assert.equal(getWorkoutStep(draft).complete, true);
  const snapshot = createGuidedSessionSnapshot(draft, 2, "2026-07-31T10:08:00.000Z");
  assert.equal(snapshot.id, SESSION_ID);
  assert.equal(snapshot.templateName, GUIDED_TEMPLATES.squatAdaptation.name);
  assert.equal(snapshot.perceivedEffort, 2);
  assert.equal(snapshot.exercises[0].status, "completed");
  assert.equal(snapshot.exercises[0].sets.length, 3);
  assert.equal(snapshot.exercises[0].sets[0].weightGrams, 8_000);
  assert.equal(estimateWorkoutDurationMinutes(draft, "2026-07-31T10:08:00.000Z"), 8);
});

test("部分完成后跳过动作会标记缩短，未完成动作标记跳过", () => {
  let draft = createWorkoutDraft({
    templateId: "strengthA",
    date: "2026-07-31",
    id: SESSION_ID,
    now: STARTED_AT,
  });
  draft = completeWorkoutSet(draft, {
    completedValue: 8,
    weightGrams: 6_000,
    now: "2026-07-31T10:01:00.000Z",
  });
  draft = skipWorkoutExercise(draft, "2026-07-31T10:02:00.000Z");
  while (!getWorkoutStep(draft).complete) {
    draft = skipWorkoutExercise(draft, "2026-07-31T10:03:00.000Z");
  }
  const snapshot = createGuidedSessionSnapshot(draft, 3, "2026-07-31T10:04:00.000Z");
  assert.equal(snapshot.exercises[0].status, "shortened");
  assert.equal(snapshot.exercises[0].sets.length, 1);
  assert.equal(snapshot.exercises[1].status, "skipped");
  assert.equal(snapshot.exercises[1].sets.length, 0);
});

test("训练过程拒绝无效次数和给徒手动作填写负重", () => {
  const strength = createWorkoutDraft({
    templateId: "strengthA",
    date: "2026-07-31",
    id: SESSION_ID,
    now: STARTED_AT,
  });
  assert.throws(
    () => completeWorkoutSet(strength, {
      completedValue: 0,
      weightGrams: 8_000,
      now: "2026-07-31T10:01:00.000Z",
    }),
    /completedValue/,
  );

  let pushup = strength;
  pushup = skipWorkoutExercise(pushup, "2026-07-31T10:01:00.000Z");
  assert.equal(getWorkoutStep(pushup).exercise.id, "pushup");
  assert.throws(
    () => completeWorkoutSet(pushup, {
      completedValue: 6,
      weightGrams: 1_000,
      now: "2026-07-31T10:02:00.000Z",
    }),
    /不记录负重/,
  );
});
