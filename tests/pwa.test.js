import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const docsRoot = resolve(projectRoot, "docs");

test("PWA manifest 使用相对入口并提供 192 与 512 图标", () => {
  const manifest = JSON.parse(readFileSync(resolve(docsRoot, "manifest.webmanifest"), "utf8"));
  assert.equal(manifest.start_url, "./");
  assert.equal(manifest.scope, "./");
  assert.equal(manifest.display, "standalone");
  assert.deepEqual(manifest.icons.map((icon) => icon.sizes), ["192x192", "512x512"]);
  manifest.icons.forEach((icon) => assert.equal(existsSync(resolve(docsRoot, icon.src)), true));
});

test("Service Worker 缓存完整应用外壳并使用显式版本", () => {
  const source = readFileSync(resolve(docsRoot, "sw.js"), "utf8");
  assert.match(source, /healthlife-shell-v\d+/);
  for (const asset of [
    "index.html", "styles.css", "app.js", "model.js", "data.js", "calendar.js",
    "stats.js", "backup.js", "storage.js", "manifest.webmanifest",
    "icons/icon-192.png", "icons/icon-512.png",
  ]) {
    assert.equal(existsSync(resolve(docsRoot, asset)), true, `${asset} 应存在`);
    assert.equal(source.includes(`./${asset}`), true, `${asset} 应进入应用外壳缓存`);
  }
  assert.match(source, /cache: "reload"/);
  assert.match(source, /request\.mode === "navigate"/);
});

test("正式页面声明 manifest 且应用注册 Service Worker", () => {
  const html = readFileSync(resolve(docsRoot, "index.html"), "utf8");
  const app = readFileSync(resolve(docsRoot, "app.js"), "utf8");
  assert.match(html, /href="\.\/manifest\.webmanifest"/);
  assert.match(app, /navigator\.serviceWorker\.register\("\.\/sw\.js"\)/);
});
