import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const html = await readFile(new URL("../docs/index.html", import.meta.url), "utf8");
const app = await readFile(new URL("../docs/app.js", import.meta.url), "utf8");

test("页面保留三个一级导航和四类记录表单", () => {
  for (const view of ["today", "trends", "records"]) assert.match(html, new RegExp(`data-view="${view}"`));
  for (const form of ["workout", "meal", "sleep", "weight"]) {
    assert.match(html, new RegExp(`data-record-form="${form}"`));
  }
  assert.doesNotMatch(html, /data-record-form="(?:activity|hydration)"/);
});

test("首页只保留四类核心卡片和简单今日训练推荐", () => {
  assert.match(html, /id="health-plan-title">今日训练/);
  assert.match(html, /id="start-guided-workout"/);
  assert.doesNotMatch(html, /id="daily-progress"|id="streak-badge"|id="edit-daily-plan"/);
});

test("首页优先展示四类记录入口，再展示今日训练推荐", () => {
  const summaryIndex = html.indexOf('class="summary-grid"');
  const planIndex = html.indexOf('class="health-plan-card"');
  assert.ok(summaryIndex >= 0);
  assert.ok(planIndex >= 0);
  assert.ok(summaryIndex < planIndex);
});

test("日历标题展示所选日期训练类型和所选月份运动天数", () => {
  for (const id of ["selected-training-label", "month-workout-label", "month-workout-days"]) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
  assert.match(app, /countWorkoutDaysInMonth\(data, selectedMonth\)/);
  assert.match(app, /elements\.selectedTrainingLabel\.textContent = TRAINING_PLAN_LABELS\[plannedType\]/);
  assert.doesNotMatch(html, /执行率/);
});

test("运动表单只在 Apple Watch 来源下展示设备详情", () => {
  assert.match(html, /id="workout-watch-fields" class="watch-fields" hidden/);
  assert.match(app, /workoutWatchFields: document\.querySelector\("#workout-watch-fields"\)/);
  assert.match(app, /\["type", "source"\]\.includes\(event\?\.target\?\.name\)/);
  assert.match(app, /elements\.workoutWatchFields\.hidden = !hasWatchDetails/);
});

test("记录表单将焦点放到高频输入，睡眠表单避免主动唤起时间控件", () => {
  assert.equal(html.match(/data-primary-input/g)?.length, 3);
  assert.match(html, /name="durationMinutes"[^>]*data-primary-input/);
  assert.match(html, /name="freeText"[^>]*data-primary-input/);
  assert.match(html, /name="weightKg"[^>]*data-primary-input/);
  assert.match(html, /id="dialog-title" tabindex="-1"/);
  assert.match(app, /form\.querySelector\("\[data-food-select\]"\) \?\? form\.querySelector\("\[data-primary-input\]"\)/);
  assert.match(app, /\(initialFocusTarget \?\? elements\.dialogTitle\)\.focus/);
});

test("每周模板只展示当前可执行的四类推荐", () => {
  const labels = app.match(/const TRAINING_PLAN_LABELS = Object\.freeze\(\{[\s\S]*?\}\);/)?.[0] ?? "";
  assert.match(labels, /strengthA: "力量 A"/);
  assert.match(labels, /strengthB: "力量 B"/);
  assert.match(labels, /runWalk: "跑走结合"/);
  assert.match(labels, /rest: "休息"/);
  assert.doesNotMatch(labels, /walking: "步行"|mobility: "拉伸放松"/);
});

test("跑走引导完成后按跑步类型保存，爬楼梯仍按有氧保存", () => {
  assert.match(app, /guidedSession\.templateId === "stairBeginner"\s*\n?\s*\? "cardio"\s*\n?\s*:\s*guidedSession\.templateId === "runWalk"\s*\n?\s*\? "running"/);
});

test("饮食支持常用食材多选、份量调整、蛋白质预览和自由文字兜底", () => {
  assert.doesNotMatch(html, /name="healthScore"|name="activeEnergyKcal"|name="maxHeartRateBpm"/);
  for (const id of [
    "meal-food-options",
    "meal-selected-foods",
    "meal-protein-preview",
    "manage-foods-from-meal",
    "food-list",
    "food-form",
    "delete-food-dialog",
  ]) assert.match(html, new RegExp(`id="${id}"`));
  assert.match(html, /name="freeText"/);
  assert.match(app, /createMealFoodSnapshot/);
  assert.match(app, /buildMealContent/);
  assert.doesNotMatch(app, /window\.confirm/);
  assert.doesNotMatch(html, /name="trackingMode"|name="confidence"|name="fullnessScore"|meal-food-select|open-custom-food|open-recipe/);
  assert.doesNotMatch(html, /onclick=/);
});

test("新建睡眠记录默认 22:30 入睡、06:30 起床", () => {
  assert.match(app, /form\.elements\.sleepTime\.value = "22:30"/);
  assert.match(app, /form\.elements\.wakeTime\.value = "06:30"/);
});

test("引导训练提供持久撤销、返回修改和两类高风险操作确认", () => {
  for (const id of [
    "undo-workout-action",
    "abandon-workout",
    "abandon-workout-dialog",
    "finish-workout-dialog",
  ]) assert.match(html, new RegExp(`id="${id}"`));
  assert.match(html, /放弃本次训练？/);
  assert.match(html, /提前结束训练？/);
});
