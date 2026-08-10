import test from "node:test";
import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";

test("PWA manifest 使用相对入口并提供两种图标", async () => {
  const manifest = JSON.parse(await readFile(new URL("../docs/manifest.webmanifest", import.meta.url), "utf8"));
  assert.equal(manifest.start_url, "./");
  assert.deepEqual(manifest.icons.map((icon) => icon.sizes), ["192x192", "512x512"]);
});

test("Service Worker 缓存精简后的完整应用外壳", async () => {
  const sw = await readFile(new URL("../docs/sw.js", import.meta.url), "utf8");
  const html = await readFile(new URL("../docs/index.html", import.meta.url), "utf8");
  const app = await readFile(new URL("../docs/app.js", import.meta.url), "utf8");
  assert.match(sw, /healthlife-shell-v29/);
  for (const file of [
    "index.html", "styles.css", "app.js", "model.js", "data.js", "calendar.js",
    "stats.js", "backup.js", "interaction.js", "analysis.js",
    "guided-workout.js", "training-insights.js", "nutrition.js", "health-stage.js",
    "storage.js", "manifest.webmanifest",
  ]) {
    assert.match(sw, new RegExp(`\\./${file.replace(".", "\\.")}`));
    await access(new URL(`../docs/${file}`, import.meta.url));
  }
  assert.match(sw, /nutrition\.js/);
  assert.match(app, /nutrition\.js/);
  assert.doesNotMatch(sw, /planning\.js/);
  assert.match(html, /\.\/styles\.css\?v=29/);
  assert.match(html, /\.\/app\.js\?v=29/);
  assert.match(html, /\.\/manifest\.webmanifest\?v=29/);
  assert.match(app, /register\("\.\/sw\.js\?v=29"\)/);
  for (const file of [
    "model.js", "data.js", "storage.js", "calendar.js", "stats.js", "backup.js",
    "interaction.js", "analysis.js", "guided-workout.js", "training-insights.js",
    "nutrition.js",
  ]) {
    assert.match(app, new RegExp(`\\./${file.replace(".", "\\.")}\\?v=29`));
    assert.match(sw, new RegExp(`\\./${file.replace(".", "\\.")}\\?v=29`));
  }
  assert.match(sw, /\.\/health-stage\.js\?v=29/);
});
