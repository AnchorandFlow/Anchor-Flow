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

export default defineConfig({
  root: path.join(here, "harness"),
  configFile: false,
  plugins: [stubSupabase(), react()],
  server: { fs: { allow: [repo] }, hmr: false, port: 5199, strictPort: false },
  logLevel: "error",
  clearScreen: false,
});
