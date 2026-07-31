import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const html = await readFile(new URL("../docs/index.html", import.meta.url), "utf8");

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

test("表单移除健康评分、活动热量和最高心率，饱腹感可选", () => {
  assert.doesNotMatch(html, /name="healthScore"|name="activeEnergyKcal"|name="maxHeartRateBpm"/);
  assert.match(html, /name="fullnessScore"/);
  assert.match(html, /value="">未记录/);
  assert.doesNotMatch(html, /onclick=/);
});
