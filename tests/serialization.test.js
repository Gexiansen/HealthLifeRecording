import test from "node:test";
import assert from "node:assert/strict";
import { createEmptyData, parseData, serializeData } from "../docs/model.js";
import { weight } from "./helpers.js";

test("schema v12 数据可以完整序列化并往返恢复", () => {
  const data = createEmptyData();
  data.weights.push(weight());
  assert.deepEqual(parseData(serializeData(data)), data);
});

test("解析拒绝非字符串、损坏 JSON、旧版本和字段越界", () => {
  assert.throws(() => parseData(null), /字符串/);
  assert.throws(() => parseData("{"), /有效 JSON/);
  const old = createEmptyData();
  old.schemaVersion = 11;
  assert.throws(() => parseData(JSON.stringify(old)), /schemaVersion/);
  const invalid = createEmptyData();
  invalid.weights.push(weight({ weightGrams: 10 }));
  assert.throws(() => parseData(JSON.stringify(invalid)), /weightGrams/);
});
