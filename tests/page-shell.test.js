import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const html = await readFile(new URL("../docs/index.html", import.meta.url), "utf8");
const app = await readFile(new URL("../docs/app.js", import.meta.url), "utf8");
const styles = await readFile(new URL("../docs/styles.css", import.meta.url), "utf8");

test("页面保留三个一级导航和四类记录表单", () => {
  for (const view of ["today", "trends", "records"]) assert.match(html, new RegExp(`data-view="${view}"`));
  for (const form of ["workout", "meal", "sleep", "weight"]) {
    assert.match(html, new RegExp(`data-record-form="${form}"`));
  }
  assert.doesNotMatch(html, /data-record-form="(?:activity|hydration)"/);
});

test("首页保留四类核心卡片，今日训练以普通记录为主、文字引导为备用", () => {
  assert.match(html, /id="health-plan-title">今日训练/);
  assert.match(html, /id="record-planned-workout"/);
  assert.match(html, /id="start-guided-workout"/);
  assert.match(html, /备用文字训练/);
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

test("运动表单按 Keep、跑步和其他运动分流，不混用场景字段", () => {
  for (const id of [
    "workout-scenario-picker",
    "repeat-last-workout",
    "workout-keep-fields",
    "workout-running-fields",
    "workout-other-fields",
    "workout-source-field",
    "workout-average-heart-rate-field",
  ]) assert.match(html, new RegExp(`id="${id}"`));
  for (const scenario of ["keep", "running", "other"]) {
    assert.match(html, new RegExp(`name="workoutScenario"[^>]*value="${scenario}"`));
  }
  assert.match(app, /getLatestWorkoutForScenario/);
  assert.match(app, /createWorkoutRepeatValues/);
  assert.match(app, /elements\.workoutKeepFields\.hidden = scenario !== "keep"/);
  assert.match(app, /elements\.workoutRunningFields\.hidden = scenario !== "running"/);
  assert.match(app, /elements\.workoutOtherFields\.hidden = scenario !== "other"/);
});

test("记录表单优先聚焦场景或高频输入，睡眠表单避免主动唤起时间控件", () => {
  assert.equal(html.match(/data-primary-input/g)?.length, 2);
  assert.match(html, /name="freeText"[^>]*data-primary-input/);
  assert.match(html, /name="weightKg"[^>]*data-primary-input/);
  assert.match(html, /id="dialog-title" tabindex="-1"/);
  assert.match(app, /form\.querySelector\("\[data-food-select\]"\) \?\? form\.querySelector\("\[data-primary-input\]"\)/);
  assert.match(app, /form\.querySelector\("\[name=workoutScenario\]:checked"\)/);
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

test("Keep 表单包含课程、完成情况、器械重量和可选不适反馈", () => {
  for (const name of [
    "keepCourseName",
    "keepCompleted",
    "keepEquipmentWeightKg",
    "keepFeedback",
    "keepDiscomfortBodyPart",
    "keepDiscomfortSeverity",
  ]) assert.match(html, new RegExp(`name="${name}"`));
  assert.match(app, /feedbackRecorded/);
  assert.match(app, /equipmentWeightGrams/);
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

test("常用食材新增和编辑使用独立二级弹窗，不再展开在设置列表底部", () => {
  for (const id of [
    "food-dialog",
    "close-food-dialog",
    "food-form",
    "food-form-fields",
    "food-protein-unit",
    "food-source-details",
  ]) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
  const settingsSection = html.slice(
    html.indexOf('id="data-dialog"'),
    html.indexOf('id="food-dialog"'),
  );
  assert.doesNotMatch(settingsSection, /id="food-form"/);
  assert.match(app, /elements\.foodDialog\.showModal\(\)/);
  assert.match(app, /bindGuardedDialog\(elements\.foodDialog, closeFoodForm\)/);
  assert.match(styles, /\.food-form-fields[^{]*\{[^}]*overflow-y:\s*auto/);
  assert.match(styles, /\.food-form-actions[^{]*\{[^}]*position:\s*sticky/);
  assert.match(styles, /@media \(max-width:\s*559px\)[\s\S]*\.food-dialog[^{]*\{[^}]*height:\s*100dvh/);
});

test("常用食材表单使用紧凑字段组，并随输入法自动保持当前输入可见", () => {
  assert.match(html, /class="food-basics-grid"/);
  assert.match(html, /class="food-protein-reference"/);
  assert.match(html, /补充来源说明（可选）/);
  assert.match(styles, /\.food-basics-grid[^{]*\{[^}]*grid-template-columns:/);
  assert.match(styles, /\.food-protein-reference[^{]*\{[^}]*grid-template-columns:/);
  assert.doesNotMatch(styles, /\.food-dialog \.field-row\s*\{[^}]*grid-template-columns:\s*1fr/);
  assert.match(app, /window\.visualViewport/);
  assert.match(app, /elements\.foodForm\.addEventListener\("focusin", handleFoodFormFocus\)/);
  assert.match(app, /elements\.foodFormFields\.scrollTop \+=/);
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
