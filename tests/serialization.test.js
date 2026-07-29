import test from "node:test";
import assert from "node:assert/strict";

import {
  createEmptyData,
  parseData,
  serializeData,
} from "../docs/model.js";

test("schema v3 数据可以完整序列化并往返恢复", () => {
  const data = createEmptyData();
  data.weights.push({
    id: "70000000-0000-4000-8000-000000000001",
    date: "2026-07-22",
    weightGrams: 68_750,
    bodyFatBasisPoints: null,
    note: "纯虚构样本",
    createdAt: "2026-07-22T08:00:00.000Z",
    updatedAt: "2026-07-22T08:00:00.000Z",
  });

  const text = serializeData(data);
  assert.deepEqual(parseData(text), data);
});

test("解析拒绝非字符串、损坏 JSON 和字段越界数据", () => {
  assert.throws(() => parseData(null), /字符串/);
  assert.throws(() => parseData("{broken"), /有效 JSON/);

  const data = createEmptyData();
  data.hydration.push({
    id: "80000000-0000-4000-8000-000000000001",
    date: "2026-07-22",
    milliliters: 25_000,
    note: "",
    createdAt: "2026-07-22T08:00:00.000Z",
    updatedAt: "2026-07-22T08:00:00.000Z",
  });
  assert.throws(() => parseData(JSON.stringify(data)), /milliliters/);
});

test("序列化前同样执行整体校验", () => {
  const data = createEmptyData();
  data.settings.weightUnit = "stone";
  assert.throws(() => serializeData(data), /weightUnit/);
});
