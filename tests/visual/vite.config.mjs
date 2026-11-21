// tests/visual/vite.config.mjs — dev server for the screen-capture harness.
// Serves tests/visual/harness/ and swaps src/lib/supabase.js for the stub.
// No /api proxy (the app's own config proxies /api to production).
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";

var here = path.dirname(fileURLToPath(import.meta.url));
var repo = path.resolve(here, "../..");
var realClient = path.join(repo, "src/lib/supabase.js");
var stub = path.join(here, "supabase-stub.js");

function stubSupabase() {
  return {
    name: "harness-stub-supabase",
    enforce: "pre",
    async resolveId(source, importer, options) {
      if (!importer || !/supabase$|supabase\.js$/.test(source)) return null;
      var r = await this.resolve(source, importer, Object.assign({}, options, { skipSelf: true }));
      if (r && path.resolve(r.id) === realClient) return stub;
      return null;
    },
  };
}

// /__hh — an in-memory household row for two-session sync checks (harness
// hhsync=1 routes the app's Supabase REST calls here). Same contract as the
// real endpoints the sync code uses: GET households, POST households (first
// insert), POST rpc/merge_household_data (data = data || patch, new
// updated_at). POST /__hh/reset seeds the row; GET /__hh/row reads it back.
function mockHousehold() {
  var row = null;
  var log = []; // GET /__hh/log: every request, in order (method, path, ts, meals dinners)
  function body(req) { return new Promise(function (r) { var b = ""; req.on("data", function (c) { b += c; }); req.on("end", function () { try { r(b ? JSON.parse(b) : null); } catch { r(null); } }); }); }
  function send(res, v) { res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify(v)); }
  var last = 0;
  function stamp() { var n = Math.max(Date.now(), last + 1); last = n; return new Date(n).toISOString(); }
  return {
    name: "harness-mock-household",
    configureServer: function (server) {
      server.middlewares.use("/__hh", async function (req, res) {
        var u = req.url || "";
        if (req.method === "POST" && u.indexOf("/reset") === 0) { var b0 = await body(req); row = b0; log = []; return send(res, {}); }
        if (u.indexOf("/row") === 0) return send(res, row);
        if (u.indexOf("/log") === 0) return send(res, log);
        log.push({ m: req.method, u: u.slice(0, 80), t: Date.now(), at: row && row.updated_at, dev: req.headers["x-harness-me"] || "" });
        if (u.indexOf("/rest/v1/households") === 0) {
          if (req.method === "GET") return send(res, row ? [row] : []);
          var b1 = await body(req);
          row = Object.assign({}, b1, { updated_at: stamp() });
          return send(res, [row]);
        }
        if (u.indexOf("/rest/v1/rpc/merge_household_data") === 0) {
          var b2 = await body(req);
          var at = stamp();
          log[log.length - 1].patch = Object.keys(b2.p_patch || {}).filter(function (k) { return k !== "_meta"; }).join(",");
          log[log.length - 1].meals = b2.p_patch && b2.p_patch.meals ? ["Wednesday", "Thursday"].map(function (d) { return d + "=" + ((b2.p_patch.meals[d] || {}).dinner || "-"); }).join(" ") : "";
          row = Object.assign({}, row || { id: b2.p_household_id }, { data: Object.assign({}, (row && row.data) || {}, b2.p_patch || {}), updated_at: at, updated_by: b2.p_updated_by || null });
          return send(res, [{ merged_at: at }]);
        }
        return send(res, req.method === "GET" ? [] : {});
      });
    },
  };
}

export default defineConfig({
  root: path.join(here, "harness"),
  configFile: false,
  plugins: [stubSupabase(), mockHousehold(), react()],
  server: { fs: { allow: [repo] }, hmr: false, port: 5199, strictPort: false },
  logLevel: "error",
  clearScreen: false,
});
