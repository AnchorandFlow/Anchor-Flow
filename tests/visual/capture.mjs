// tests/visual/capture.mjs — renders the six Flow full-view screens (Shopping,
// Meals, Calendar, Waves, Tide Pool, Lighthouse) in headless Chrome through
// the harness and returns each screen's DOM after each step.
//
//   node tests/visual/capture.mjs --write   regenerate the flag-off golden
//   node tests/visual/capture.mjs --shots   390px screenshots, flag on (scratch dir)
//
// The golden (tests/ui/__golden__/flow-screens-legacy.json) is the flag-off
// output recorded BEFORE the redesign touched these screens; the flag-off
// test (tests/ui/flow-screens-legacy.test.js) re-captures and compares.
import { createServer } from "vite";
import { execFile } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

var here = path.dirname(fileURLToPath(import.meta.url));
var repo = path.resolve(here, "../..");
export var GOLDEN = path.join(repo, "tests/ui/__golden__/flow-screens-legacy.json");

export var CHROME = [
  process.env.CHROME_PATH,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
].filter(function (p) { return p && fs.existsSync(p); })[0] || null;

// Legacy (flag-off) walk: [snapshot label, text of the control to click first]
export var LEGACY_STEPS = {
  shop: [["initial", null]],
  meals: [["This Week", null], ["Next Week", "Next Week"], ["Month", "Month"], ["Prep", "Prep"], ["SOS", "SOS"], ["Meal Bank", "Meal Bank"], ["Recipes", "Recipes"]],
  calendar: [["month", null], ["week", "week"], ["day", "day"], ["year", "year"]],
  waves: [["initial", null]],
  tidepool: [["initial", null], ["Ollie", "Ollie"]],
  lighthouse: [["Overview", null], ["Plan", "Plan"], ["Records", "Records"], ["Growth", "Growth"], ["Library", "Library"]],
};

function run(file, args, timeout) {
  return new Promise(function (resolve, reject) {
    execFile(file, args, { maxBuffer: 256 * 1024 * 1024, timeout: timeout || 90000 }, function (err, stdout) {
      if (err) reject(err); else resolve(stdout);
    });
  });
}

export async function startServer() {
  var server = await createServer({ configFile: path.join(here, "vite.config.mjs") });
  await server.listen();
  var url = server.resolvedUrls.local[0];
  return { server: server, url: url };
}

function chromeArgs(extra) {
  var profile = fs.mkdtempSync(path.join(os.tmpdir(), "af-harness-"));
  return ["--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check", "--hide-scrollbars", "--user-data-dir=" + profile].concat(extra);
}

export async function captureScreen(baseUrl, tab, steps, opts) {
  var o = opts || {};
  var q = "tab=" + encodeURIComponent(tab) + "&hh=" + (o.redesign ? "beta" : "other") + (o.emojis ? "&emojis=1" : "") + "&steps=" + encodeURIComponent(JSON.stringify(steps));
  var html = await run(CHROME, chromeArgs(["--window-size=500,900", "--virtual-time-budget=30000", "--dump-dom", baseUrl + "?" + q]), 120000);
  var m = html.match(/<script type="application\/json" id="__capture">([^<]*)<\/script>/);
  if (!m) throw new Error("no capture for " + tab + " (page never finished)");
  var res = JSON.parse(decodeURIComponent(m[1]));
  if (res.fatal) throw new Error(tab + ": " + res.fatal);
  if (res.errors && res.errors.length) throw new Error(tab + ": " + res.errors.join("; "));
  return res.snapshots;
}

export async function captureAll(opts) {
  var o = opts || {};
  var steps = o.steps || LEGACY_STEPS;
  var srv = await startServer();
  try {
    var out = {};
    for (var tab of Object.keys(steps)) {
      var snaps = await captureScreen(srv.url, tab, steps[tab], o);
      Object.keys(snaps).forEach(function (k) { out[tab + ":" + k] = snaps[k]; });
    }
    return out;
  } finally {
    await srv.server.close();
  }
}

// Screenshot one harness page inside a 390px-wide iframe (headless Chrome
// will not size its window below ~500px).
export async function screenshot(baseUrl, tab, file, opts) {
  var o = opts || {};
  var q = "tab=" + encodeURIComponent(tab) + "&hh=" + (o.redesign ? "beta" : "other") + (o.emojis ? "&emojis=1" : "") + "&shot=1&steps=" + encodeURIComponent(JSON.stringify(o.steps || [])) ;
  var frameUrl = baseUrl + "?" + q;
  var wrapper = baseUrl.replace(/\/$/, "") + "/frame.html?src=" + encodeURIComponent(frameUrl) + "&w=" + (o.width || 390) + "&h=" + (o.height || 1600);
  await run(CHROME, chromeArgs(["--window-size=" + ((o.width || 390) + 40) + "," + (o.height || 1600), "--virtual-time-budget=30000", "--screenshot=" + file, wrapper]), 120000);
}

var isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  if (!CHROME) { console.error("Chrome not found (set CHROME_PATH)"); process.exit(1); }
  if (process.argv.includes("--write")) {
    var all = await captureAll();
    fs.mkdirSync(path.dirname(GOLDEN), { recursive: true });
    fs.writeFileSync(GOLDEN, JSON.stringify(all, null, 1) + "\n");
    console.log("wrote " + GOLDEN + " (" + Object.keys(all).length + " snapshots)");
  } else {
    var a = await captureAll();
    Object.keys(a).forEach(function (k) { console.log(k, a[k].length); });
  }
}
