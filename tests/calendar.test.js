import test from "node:test";
import assert from "node:assert/strict";
import {
  getCalendarLabel,
  getDailyStatus,
  getMonthGrid,
  getWeekDates,
  shiftCalendarAnchor,
} from "../docs/calendar.js";
import { createEmptyData } from "../docs/model.js";
import { meal, sleep, weight, workout } from "./helpers.js";

test("日历状态只统计运动、饮食、睡眠和体重", () => {
  const data = createEmptyData();
  data.workouts.push(workout());
  data.meals.push(meal());
  data.sleepRecords.push(sleep());
  data.weights.push(weight());
  assert.deepEqual(getDailyStatus(data, "2026-07-31"), {
    categories: { workout: true, meal: true, sleep: true, weight: true },
    completedCount: 4,
    hasRecord: true,
  });
});

test("周、月日历使用本地自然日字符串", () => {
  assert.deepEqual(getWeekDates("2026-07-31"), [
    "2026-07-27", "2026-07-28", "2026-07-29", "2026-07-30",
    "2026-07-31", "2026-08-01", "2026-08-02",
  ]);
  assert.equal(getMonthGrid("2026-07-31").length, 42);
  assert.equal(shiftCalendarAnchor("2026-07-31", "week", 1), "2026-08-07");
  assert.match(getCalendarLabel("2026-07-31", "week"), /2026年/);
});
