import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const html = await readFile(new URL("../docs/index.html", import.meta.url), "utf8");

test("正式页面只引用本地相对运行时资源", () => {
  assert.match(html, /href="\.\/styles\.css"/);
  assert.match(html, /src="\.\/app\.js"/);
  assert.doesNotMatch(html, /https?:\/\//);
});

test("页面包含三个一级导航和六类记录表单", () => {
  for (const view of ["today", "trends", "records"]) {
    assert.match(html, new RegExp(`data-view="${view}"`));
  }
  for (const form of ["workout", "activity", "meal", "sleep", "weight", "hydration"]) {
    assert.match(html, new RegExp(`data-record-form="${form}"`));
  }
  assert.match(html, /id="custom-food-dialog"/);
  assert.match(html, /id="recipe-dialog"/);
  assert.match(html, /id="export-analysis"/);
  assert.match(html, /id="meal-food-unit"/);
  assert.match(html, /value="appleWatch"/);
});

test("首页日期只通过日历选择，不保留重复的精确日期输入", () => {
  assert.doesNotMatch(html, /id="selected-date"/);
  assert.doesNotMatch(html, />精确选择</);
  assert.match(html, /id="daily-progress" hidden aria-hidden="true"/);
});

test("正式页面不使用内联事件处理器", () => {
  assert.doesNotMatch(html, /\son[a-z]+\s*=/i);
});
