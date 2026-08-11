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

test("训练日日历状态按运动、饮食、睡眠和体重四项统计", () => {
  const data = createEmptyData();
  data.workouts.push(workout({ date: "2026-07-28" }));
  data.meals.push(meal({ date: "2026-07-28" }));
  data.sleepRecords.push(sleep({ date: "2026-07-28" }));
  data.weights.push(weight({ date: "2026-07-28" }));
  assert.deepEqual(getDailyStatus(data, "2026-07-28"), {
    categories: { workout: true, meal: true, sleep: true, weight: true },
    completedCount: 4,
    expectedCount: 4,
    hasRecord: true,
    plannedRest: false,
  });
});

test("休息日无运动时按三项统计，额外运动后恢复为四项", () => {
  const data = createEmptyData();
  data.meals.push(meal({ date: "2026-08-02" }));
  data.sleepRecords.push(sleep({ date: "2026-08-02" }));
  data.weights.push(weight({ date: "2026-08-02" }));

  assert.deepEqual(getDailyStatus(data, "2026-08-02"), {
    categories: { workout: false, meal: true, sleep: true, weight: true },
    completedCount: 3,
    expectedCount: 3,
    hasRecord: true,
    plannedRest: true,
  });

  data.workouts.push(workout({ date: "2026-08-02" }));
  assert.deepEqual(getDailyStatus(data, "2026-08-02"), {
    categories: { workout: true, meal: true, sleep: true, weight: true },
    completedCount: 4,
    expectedCount: 4,
    hasRecord: true,
    plannedRest: true,
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
