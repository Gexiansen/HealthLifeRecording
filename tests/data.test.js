import test from "node:test";
import assert from "node:assert/strict";
import {
  allRecordsByDate,
  deleteRecord,
  findDailyRecord,
  recordsForDate,
  saveRecord,
  updateWeeklyTraining,
} from "../docs/data.js";
import { createEmptyData } from "../docs/model.js";
import { IDS, meal, sleep, weight, workout } from "./helpers.js";

test("四类记录可新增、编辑、按日期汇总与删除且不修改原对象", () => {
  const original = createEmptyData();
  let data = saveRecord(original, "workouts", workout());
  data = saveRecord(data, "meals", meal());
  data = saveRecord(data, "sleepRecords", sleep());
  data = saveRecord(data, "weights", weight());
  assert.equal(original.workouts.length, 0);
  assert.equal(recordsForDate(data, "2026-07-31").length, 4);
  data = saveRecord(data, "workouts", workout({ durationMinutes: 45 }));
  assert.equal(data.workouts[0].durationMinutes, 45);
  const result = deleteRecord(data, "meals", IDS.meal);
  assert.equal(result.data.meals.length, 0);
});

test("睡眠和体重支持每日唯一查询，其他集合拒绝该查询", () => {
  const data = createEmptyData();
  data.sleepRecords.push(sleep());
  assert.equal(findDailyRecord(data, "sleepRecords", "2026-07-31").id, IDS.sleep);
  assert.throws(() => findDailyRecord(data, "workouts", "2026-07-31"), /不支持/);
});

test("记录列表按日期和创建时间倒序，每周模板直接更新根字段", () => {
  const data = createEmptyData();
  data.workouts.push(workout({ date: "2026-07-30" }));
  data.weights.push(weight());
  assert.equal(allRecordsByDate(data)[0].collectionName, "weights");
  const weekly = [...data.weeklyTraining];
  weekly[0] = "walking";
  const next = updateWeeklyTraining(data, weekly);
  assert.equal(next.weeklyTraining[0], "walking");
  assert.equal(data.weeklyTraining[0], "rest");
});
