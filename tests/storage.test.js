import test from "node:test";
import assert from "node:assert/strict";

import {
  loadData,
  saveData,
  STORAGE_KEY,
  StorageWriteError,
} from "../docs/storage.js";
import { createEmptyData } from "../docs/model.js";

function memoryStorage(initial = null) {
  let value = initial;
  return {
    getItem(key) {
      assert.equal(key, STORAGE_KEY);
      return value;
    },
    setItem(key, next) {
      assert.equal(key, STORAGE_KEY);
      value = next;
    },
  };
}

test("空存储返回新的 schema v1 数据但不立即写入", () => {
  const storage = memoryStorage();
  const result = loadData(storage);
  assert.equal(result.status, "empty");
  assert.deepEqual(result.data, createEmptyData());
  assert.equal(storage.getItem(STORAGE_KEY), null);
});

test("有效内容保存后可以重新读取", () => {
  const storage = memoryStorage();
  const data = createEmptyData();
  const serialized = saveData(data, storage);
  assert.equal(storage.getItem(STORAGE_KEY), serialized);
  assert.deepEqual(loadData(storage), {
    status: "ready",
    data,
    raw: serialized,
    error: null,
  });
});

test("损坏内容保留原文并进入写入锁定状态", () => {
  const raw = "{broken";
  const result = loadData(memoryStorage(raw));
  assert.equal(result.status, "corrupt");
  assert.equal(result.data, null);
  assert.equal(result.raw, raw);
  assert.match(result.error.message, /有效 JSON/);
});

test("读取不可用和保存失败返回明确错误", () => {
  const readError = new Error("blocked");
  const unavailable = loadData({
    getItem() {
      throw readError;
    },
  });
  assert.equal(unavailable.status, "unavailable");
  assert.equal(unavailable.error, readError);

  assert.throws(
    () =>
      saveData(createEmptyData(), {
        setItem() {
          throw new Error("quota");
        },
      }),
    StorageWriteError,
  );
});
