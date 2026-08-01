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

test("表单移除健康评分、活动热量和最高心率，饱腹感可选", () => {
  assert.doesNotMatch(html, /name="healthScore"|name="activeEnergyKcal"|name="maxHeartRateBpm"/);
  assert.match(html, /name="fullnessScore"/);
  assert.match(html, /value="">未记录/);
  assert.doesNotMatch(html, /onclick=/);
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
