import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const html = await readFile(new URL("../docs/index.html", import.meta.url), "utf8");

test("正式页面只引用本地相对运行时资源", () => {
  assert.match(html, /href="\.\/styles\.css"/);
  assert.match(html, /src="\.\/app\.js"/);
  assert.doesNotMatch(html, /https?:\/\//);
});

test("页面包含三个一级导航和五类记录表单", () => {
  for (const view of ["today", "trends", "records"]) {
    assert.match(html, new RegExp(`data-view="${view}"`));
  }
  for (const form of ["workout", "meal", "sleep", "weight", "hydration"]) {
    assert.match(html, new RegExp(`data-record-form="${form}"`));
  }
});

test("正式页面不使用内联事件处理器", () => {
  assert.doesNotMatch(html, /\son[a-z]+\s*=/i);
});
