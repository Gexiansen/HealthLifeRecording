import test from "node:test";
import assert from "node:assert/strict";

import {
  calculateRecordingStreak,
  getCalendarLabel,
  getDailyStatus,
  getMonthGrid,
  getWeekDates,
  shiftCalendarAnchor,
} from "../docs/calendar.js";
import { createEmptyData } from "../docs/model.js";

const timestamp = "2026-07-23T08:00:00.000Z";

function weight(id, date) {
  return {
    id,
    date,
    weightGrams: 70_000,
    bodyFatBasisPoints: null,
    note: "",
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

test("周视图始终从周一开始并覆盖七天", () => {
  assert.deepEqual(getWeekDates("2026-07-23"), [
    "2026-07-20",
    "2026-07-21",
    "2026-07-22",
    "2026-07-23",
    "2026-07-24",
    "2026-07-25",
    "2026-07-26",
  ]);
  assert.equal(getCalendarLabel("2026-07-23", "week"), "2026年7月20日—7月26日");
});

test("月视图固定六周并标记相邻月份日期", () => {
  const grid = getMonthGrid("2026-07-23");
  assert.equal(grid.length, 42);
  assert.deepEqual(grid[0], { date: "2026-06-29", inCurrentMonth: false });
  assert.deepEqual(grid[2], { date: "2026-07-01", inCurrentMonth: true });
  assert.equal(getCalendarLabel("2026-07-23", "month"), "2026年7月");
});

test("周和月导航按明确周期移动", () => {
  assert.equal(shiftCalendarAnchor("2026-07-23", "week", -1), "2026-07-16");
  assert.equal(shiftCalendarAnchor("2026-07-23", "month", 1), "2026-08-01");
  assert.equal(shiftCalendarAnchor("2026-01-20", "month", -1), "2025-12-01");
});

test("每日状态按六类记录计算且同类多条只计一次", () => {
  const data = createEmptyData();
  data.weights.push(weight("10000000-0000-4000-8000-000000000001", "2026-07-23"));
  data.workouts.push({
    id: "20000000-0000-4000-8000-000000000001",
    date: "2026-07-23",
    type: "walking",
    durationMinutes: 30,
    intensity: 1,
    source: "manual",
    activeEnergyKcal: null,
    averageHeartRateBpm: null,
    maxHeartRateBpm: null,
    distanceMeters: null,
    guidedSession: null,
    note: "",
    createdAt: timestamp,
    updatedAt: timestamp,
  });
  data.workouts.push({ ...data.workouts[0], id: "20000000-0000-4000-8000-000000000002" });
  assert.deepEqual(getDailyStatus(data, "2026-07-23"), {
    categories: {
      workout: true,
      dailyActivity: false,
      meal: false,
      sleep: false,
      weight: true,
      hydration: false,
    },
    completedCount: 2,
    hasRecord: true,
  });
});

test("连续记录允许今天未记录时保留截至昨天的结果", () => {
  const data = createEmptyData();
  data.weights.push(
    weight("30000000-0000-4000-8000-000000000001", "2026-07-20"),
    weight("30000000-0000-4000-8000-000000000002", "2026-07-21"),
    weight("30000000-0000-4000-8000-000000000003", "2026-07-22"),
  );
  assert.deepEqual(calculateRecordingStreak(data, "2026-07-23"), {
    days: 3,
    todayRecorded: false,
  });
  data.weights.push(weight("30000000-0000-4000-8000-000000000004", "2026-07-23"));
  assert.deepEqual(calculateRecordingStreak(data, "2026-07-23"), {
    days: 4,
    todayRecorded: true,
  });
});
