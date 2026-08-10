import test from "node:test";
import assert from "node:assert/strict";
import {
  calculatePaceSecondsPerKilometer,
  calculateVisibilityScroll,
  filterRecordItems,
  getDateContext,
  getDefaultMealType,
  getDefaultWorkoutScenario,
  getLatestWorkoutForScenario,
  getRestoreLabel,
  createWorkoutRepeatValues,
} from "../docs/interaction.js";
import { keepWorkout, workout } from "./helpers.js";

test("日期语境只区分今日与历史日期标题", () => {
  assert.deepEqual(getDateContext("2026-07-31", "2026-07-31"), { heading: "今日" });
  assert.deepEqual(getDateContext("2026-07-30", "2026-07-31"), { heading: "7月30日" });
});

test("默认餐次、配速、筛选和恢复文案保持有效", () => {
  assert.equal(getDefaultMealType(7), "breakfast");
  assert.equal(getDefaultMealType(12), "lunch");
  assert.equal(calculatePaceSecondsPerKilometer(30, 5_000), 360);
  const items = [{ collectionName: "workouts", record: { date: "2026-07-31" } }];
  assert.equal(filterRecordItems(items, "workouts", "2026-07").length, 1);
  assert.throws(() => filterRecordItems(items, "plans"), /不受支持/);
  assert.match(getRestoreLabel(2, 3).summary, /完整替换/);
});

test("输入区域被遮挡时计算最小滚动距离，已可见时不移动", () => {
  assert.equal(calculateVisibilityScroll(100, 400, 140, 184), 0);
  assert.equal(calculateVisibilityScroll(100, 400, 380, 428), 36);
  assert.equal(calculateVisibilityScroll(100, 400, 72, 116), -36);
});

test("每周模板映射默认运动场景，同场景最近记录按日期和创建时间选择", () => {
  assert.equal(getDefaultWorkoutScenario("strengthA"), "keep");
  assert.equal(getDefaultWorkoutScenario("strengthB"), "keep");
  assert.equal(getDefaultWorkoutScenario("runWalk"), "running");
  assert.equal(getDefaultWorkoutScenario("rest"), "other");
  const records = [
    keepWorkout({ date: "2026-07-29" }),
    keepWorkout({
      id: "99999999-9999-4999-8999-999999999999",
      date: "2026-07-31",
      createdAt: "2026-07-31T01:00:00.000Z",
      keepDetails: { ...keepWorkout().keepDetails, courseName: "虚构较新课程" },
    }),
    workout(),
  ];
  assert.equal(getLatestWorkoutForScenario(records, "keep").keepDetails.courseName, "虚构较新课程");
  assert.equal(getLatestWorkoutForScenario(records, "other"), null);
});

test("重复上次训练只复制可复用输入，不复制单次心率、不适和备注", () => {
  const previous = keepWorkout({
    source: "appleWatch",
    averageHeartRateBpm: 135,
    note: "上次单次备注",
    keepDetails: {
      ...keepWorkout().keepDetails,
      completed: false,
      feedbackRecorded: true,
      discomfort: { bodyPart: "knee", severity: 2 },
    },
  });
  assert.deepEqual(createWorkoutRepeatValues(previous), {
    scenario: "keep",
    type: "strength",
    durationMinutes: 30,
    intensity: 2,
    source: "appleWatch",
    averageHeartRateBpm: null,
    distanceMeters: null,
    keepDetails: {
      courseName: "虚构全身力量课程",
      completed: true,
      equipmentWeightGrams: 8_000,
      feedbackRecorded: false,
      discomfort: null,
    },
    note: "",
  });
});
